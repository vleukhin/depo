// Взаимодействие с REST API биржи KuCoin.
//
// Приватные запросы подписываются по схеме ключей v2:
//   KC-API-SIGN        = base64(HMAC-SHA256(secret, timestamp + METHOD + endpoint + body))
//   KC-API-PASSPHRASE  = base64(HMAC-SHA256(secret, passphrase))   // v2: подпись, а не сырой passphrase
//   KC-API-KEY-VERSION = 2
// Для GET endpoint включает query-строку, а тело запроса — пустое.
//
// Модуль намеренно ничего не знает о сущностях приложения (funds/placements/БД) —
// это чистый клиент биржи. Достаточно ключа с правом General (только чтение).

import { createHmac } from "node:crypto";

import type { Dispatcher } from "undici";

import { decimalToMicro } from "@/lib/money";
import { getExchangeDispatcher } from "@/lib/proxy";

const BASE_URL = process.env.KUCOIN_API_URL ?? "https://api.kucoin.com";
const OK_CODE = "200000"; // прикладной «успех»; сам HTTP-статус при этом почти всегда 200

const hmac = (secret: string, payload: string): string =>
  createHmac("sha256", secret).update(payload).digest("base64");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function credentials(): { key: string; secret: string; passphrase: string } {
  const key = process.env.KUCOIN_API_KEY;
  const secret = process.env.KUCOIN_API_SECRET;
  const passphrase = process.env.KUCOIN_API_PASSPHRASE;
  if (!key || !secret || !passphrase) {
    throw new Error(
      "Не заданы переменные KUCOIN_API_KEY / KUCOIN_API_SECRET / KUCOIN_API_PASSPHRASE",
    );
  }
  return { key, secret, passphrase };
}

type QueryParams = Record<string, string | number | undefined>;

/** Собирает query-строку, отбрасывая пустые значения. Пусто -> "". */
function buildQuery(params: QueryParams = {}): string {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => [k, String(v)] as [string, string]);
  const qs = new URLSearchParams(pairs).toString();
  return qs ? `?${qs}` : "";
}

interface KucoinEnvelope<T> {
  code: string;
  msg?: string;
  data?: T;
}

/**
 * Подписанный приватный запрос к KuCoin; возвращает поле `data` из ответа.
 * KuCoin отдаёт HTTP 200 даже на прикладные ошибки, поэтому проверяется и `code`.
 * На 429 (rate limit) — до 3 повторов с растущей паузой; подпись пересчитывается
 * на каждой попытке (timestamp обязан совпадать с заголовком).
 */
export async function signedRequest<T>(
  method: "GET" | "POST",
  path: string,
  opts: { query?: QueryParams; body?: unknown } = {},
): Promise<T> {
  const { key, secret, passphrase } = credentials();
  const endpoint = `${path}${buildQuery(opts.query)}`;
  const body = opts.body === undefined ? "" : JSON.stringify(opts.body);

  let res: Response;
  let attempt = 0;
  for (;;) {
    const timestamp = String(Date.now());
    res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: {
        "KC-API-KEY": key,
        "KC-API-TIMESTAMP": timestamp,
        "KC-API-SIGN": hmac(secret, timestamp + method + endpoint + body),
        "KC-API-PASSPHRASE": hmac(secret, passphrase),
        "KC-API-KEY-VERSION": "2",
        "Content-Type": "application/json",
      },
      body: method === "GET" ? undefined : body,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
      // dispatcher — опция undici (глобальный fetch на нём и построен); в типе
      // RequestInit её нет, поэтому приведение. undefined -> прямой fetch.
      dispatcher: getExchangeDispatcher(),
    } as RequestInit & { dispatcher?: Dispatcher });
    if (res.status !== 429 || attempt >= 3) break;
    attempt++;
    await sleep(1000 * attempt); // 1с, 2с, 3с
  }

  const json = (await res.json().catch(() => null)) as KucoinEnvelope<T> | null;
  if (!res.ok || !json || json.code !== OK_CODE) {
    throw new Error(`KuCoin: ${json?.msg ?? `HTTP ${res.status}`}`);
  }
  if (json.data === undefined) {
    throw new Error("KuCoin: пустой ответ");
  }
  return json.data;
}

// ================= БАЛАНСЫ =================

export type KucoinAccountType = "main" | "trade" | "trade_hf" | "margin";

export interface KucoinAccount {
  id: string;
  currency: string;
  type: KucoinAccountType;
  balance: string; // суммы KuCoin отдаёт строками; десятичный разбор — на стороне вызывающего
  available: string;
  holds: string;
}

/**
 * Список счетов с балансами: GET /api/v1/accounts.
 * Необязательные фильтры — по валюте и по типу счёта.
 */
export function fetchAccounts(
  filter: { currency?: string; type?: KucoinAccountType } = {},
): Promise<KucoinAccount[]> {
  return signedRequest<KucoinAccount[]>("GET", "/api/v1/accounts", { query: filter });
}

// Какие типы счетов KuCoin входят в каждый тип счёта приложения:
// "main" — funding-счёт (main), "spot" — торговые счета (trade + высокочастотный trade_hf).
const ACCOUNT_TYPES: Record<"spot" | "main", KucoinAccountType[]> = {
  main: ["main"],
  spot: ["trade", "trade_hf"],
};

/**
 * Доступный баланс произвольной монеты на счетах указанного типа в целых
 * micro-единицах (монета × 1 000 000). Берётся `available` (без заблокированного
 * в ордерах, поле `holds`), а не полный `balance`.
 * Один запрос с фильтром по валюте; фильтрация по типам счёта — локально,
 * потому что API принимает лишь один type, а для "spot" нужны два.
 * Если подходящих счетов нет — 0.
 */
async function fetchCoinBalanceMicro(coin: string, account: "spot" | "main"): Promise<number> {
  const types = ACCOUNT_TYPES[account];
  const accounts = await fetchAccounts({ currency: coin });
  return accounts
    .filter((a) => a.currency === coin && types.includes(a.type))
    .reduce((sum, a) => sum + decimalToMicro(a.available), 0);
}

/** Суммарный баланс USDT на счёте указанного типа в целых micro-USDT (USDT × 1 000 000). */
export function fetchUsdtBalanceMicro(account: "spot" | "main"): Promise<number> {
  return fetchCoinBalanceMicro("USDT", account);
}

/**
 * Суммарный баланс TRX на счёте указанного типа в целых micro-TRX (TRX × 1 000 000).
 * У TRX 6 знаков после запятой — та же точность, что у USDT.
 */
export function fetchTrxBalanceMicro(account: "spot" | "main"): Promise<number> {
  return fetchCoinBalanceMicro("TRX", account);
}
