// Взаимодействие с REST API TronRental (аренда энергии и bandwidth в сети TRON).
//
// Аутентификация — заголовком X-API-Key. Оплата списывается с TRX-баланса
// аккаунта TronRental (пополняется депозитом на сайте), а не с кошелька-получателя.
// Энергия сдаётся только на 1 час, bandwidth — на 1 час или сутки.
//
// Запросы идут напрямую, мимо EXCHANGE_PROXY_URL: IP-whitelist у ключа
// TronRental опционален. Модуль ничего не знает о сущностях приложения —
// это чистый клиент сервиса. Документация: https://docs.tronrental.com

import type { BandwidthDuration } from "@/types";

const BASE_URL = process.env.TRONRENTAL_API_URL ?? "https://api.tronrental.com/v1";

// Энергия на один перевод USDT: получателю, уже державшему USDT, и новому
// (у нового в контракте создаётся слот хранения — вдвое дороже).
export const ENERGY_PER_TRANSFER = 65_000;
export const ENERGY_PER_TRANSFER_NEW = 131_000;
// Bandwidth на один перевод USDT, когда бесплатный дневной лимит адреса исчерпан.
export const BANDWIDTH_PER_TRANSFER = 350;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function apiKey(): string {
  const key = process.env.TRONRENTAL_API_KEY;
  if (!key) throw new Error("Не задана переменная TRONRENTAL_API_KEY");
  return key;
}

type QueryParams = Record<string, string | number>;

/**
 * Текст ошибки из ответа TronRental. Форм у ошибок несколько (см. docs «Errors»):
 * `detail.error.message`, затем `error.message`, затем `detail` строкой или
 * массивом ошибок валидации полей.
 */
function errorMessage(json: unknown, status: number): string {
  const body = json as {
    detail?: unknown;
    error?: { message?: string };
  } | null;
  const detail = body?.detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const msg = (detail as { error?: { message?: string } }).error?.message;
    if (msg) return msg;
  }
  if (body?.error?.message) return body.error.message;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: string } | undefined;
    if (first?.msg) return first.msg;
  }
  return `HTTP ${status}`;
}

/**
 * Запрос к TronRental с ключом. На 429/5xx повторяет только GET (до 3 раз,
 * пауза из Retry-After или растущая): покупку повторять нельзя — при потерянном
 * ответе заказ мог уже пройти, и повтор списал бы деньги дважды.
 */
async function request<T>(
  method: "GET" | "POST",
  path: string,
  opts: { query?: QueryParams; body?: unknown } = {},
): Promise<T> {
  const key = apiKey();
  const qs = opts.query
    ? `?${new URLSearchParams(Object.entries(opts.query).map(([k, v]) => [k, String(v)]))}`
    : "";

  let res: Response;
  let attempt = 0;
  for (;;) {
    res = await fetch(`${BASE_URL}${path}${qs}`, {
      method,
      headers: { "X-API-Key": key, "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    const retryable = res.status === 429 || res.status >= 500;
    if (method !== "GET" || !retryable || attempt >= 3) break;
    attempt++;
    const retryAfter = Number(res.headers.get("Retry-After"));
    await sleep(retryAfter > 0 && retryAfter <= 10 ? retryAfter * 1000 : 1000 * attempt);
  }

  const json = (await res.json().catch(() => null)) as T | null;
  if (res.status === 402) throw new Error("Недостаточно средств на балансе TronRental");
  if (!res.ok || json === null) {
    throw new Error(`TronRental: ${errorMessage(json, res.status)}`);
  }
  return json;
}

/** Строковая сумма TRX из ответа -> число; мусор считаем ошибкой, а не нулём. */
function trx(value: string | number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error("TronRental: некорректная сумма в ответе");
  return n;
}

// ================= ОБЪЁМЫ =================

/** Объёмы аренды на N переводов USDT; bandwidth — null, если не нужен. */
export function rentalVolumes(p: {
  transfers: number;
  newRecipient: boolean;
  bandwidth: BandwidthDuration;
}): { energy: number; bandwidth: number | null } {
  const perTransfer = p.newRecipient ? ENERGY_PER_TRANSFER_NEW : ENERGY_PER_TRANSFER;
  return {
    energy: p.transfers * perTransfer,
    bandwidth: p.bandwidth === "none" ? null : p.transfers * BANDWIDTH_PER_TRANSFER,
  };
}

// ================= БАЛАНС И ЦЕНЫ =================

/** TRX-баланс аккаунта TronRental: GET /account/balance. */
export async function fetchBalanceTrx(): Promise<number> {
  const res = await request<{ balance_trx: string }>("GET", "/account/balance");
  return trx(res.balance_trx);
}

/**
 * Итоговая цена аренды энергии (аренда + фиксированная комиссия за заказ) по
 * персональному тарифу ключа: GET /energy/quote.
 */
export async function quoteEnergy(volume: number): Promise<number> {
  const res = await request<{ total_trx: string }>("GET", "/energy/quote", {
    query: { volume, duration: "1h" },
  });
  return trx(res.total_trx);
}

/**
 * Цена аренды bandwidth: `volume × price_sun / 1e6 + fixed_fee` по ставкам из
 * GET /bandwidth/prices (отдельного quote-эндпоинта у bandwidth нет).
 */
export async function quoteBandwidth(
  volume: number,
  duration: Exclude<BandwidthDuration, "none">,
): Promise<number> {
  const res = await request<{
    price_sun_1h: number | string;
    price_sun_1d: number | string;
    fixed_fee_trx: string;
  }>("GET", "/bandwidth/prices");
  const priceSun = trx(duration === "1h" ? res.price_sun_1h : res.price_sun_1d);
  return (volume * priceSun) / 1_000_000 + trx(res.fixed_fee_trx);
}

// ================= ПОКУПКА =================

export interface RentalOrder {
  id: number;
  price: number; // списано с баланса TronRental, TRX
  status: string; // pending / filled / failed
}

interface OrderResponse {
  id: number;
  price_trx: string;
  status: string;
}

const toOrder = (r: OrderResponse): RentalOrder => ({
  id: r.id,
  price: trx(r.price_trx),
  status: r.status,
});

/** Аренда энергии на 1 час для адреса: POST /energy/buy. */
export async function buyEnergy(address: string, volume: number): Promise<RentalOrder> {
  const res = await request<OrderResponse>("POST", "/energy/buy", {
    body: { target_address: address, volume, duration: "1h" },
  });
  return toOrder(res);
}

/** Аренда bandwidth для адреса: POST /bandwidth/buy. */
export async function buyBandwidth(
  address: string,
  volume: number,
  duration: Exclude<BandwidthDuration, "none">,
): Promise<RentalOrder> {
  const res = await request<OrderResponse>("POST", "/bandwidth/buy", {
    body: { target_address: address, volume, duration },
  });
  return toOrder(res);
}
