// Получение баланса USDT (TRC-20) в сети TRON через TronGrid.
//
// Баланс читается вызовом balanceOf(address) на контракте USDT
// (triggerconstantcontract), а не через /v1/accounts/{address}:
// эндпоинт аккаунтов отдаёт пустые данные для неактивированных адресов,
// хотя USDT на них уже может лежать — балансы TRC-20 хранятся в самом
// контракте и не зависят от активации аккаунта.

import { createHash } from "node:crypto";
import type { Trc20Transfer, Trc20TransfersPage } from "@/types";

export const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
const TRON_ADDRESS_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export function isTronAddress(value: string | null | undefined): value is string {
  return !!value && TRON_ADDRESS_RE.test(value.trim());
}

// --- base58check-декодирование TRON-адреса в 20-байтовый hex ---

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58Decode(s: string): Uint8Array {
  let num = 0n;
  for (const ch of s) {
    const i = B58.indexOf(ch);
    if (i < 0) throw new Error("Некорректный base58-символ в адресе");
    num = num * 58n + BigInt(i);
  }
  const bytes: number[] = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  for (const ch of s) {
    if (ch !== "1") break;
    bytes.unshift(0);
  }
  return Uint8Array.from(bytes);
}

/** base58check-адрес (T...) -> hex 20 байт (без префикса 0x41), с проверкой контрольной суммы. */
function tronAddressToHex20(address: string): string {
  const decoded = base58Decode(address.trim());
  if (decoded.length !== 25 || decoded[0] !== 0x41) {
    throw new Error("Некорректный TRON-адрес");
  }
  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  const hash = createHash("sha256")
    .update(createHash("sha256").update(payload).digest())
    .digest();
  for (let i = 0; i < 4; i++) {
    if (hash[i] !== checksum[i]) throw new Error("Некорректный TRON-адрес (контрольная сумма)");
  }
  return Buffer.from(payload.subarray(1)).toString("hex");
}

// --- запросы к TronGrid ---

const TRONGRID_BASE = "https://api.trongrid.io";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Запрос к TronGrid: общие заголовки (с ключом, если он задан), таймаут 10с
 * и до 3 повторов на 429 с растущей паузой. Бросает на любой не-2xx ответ.
 */
async function tronFetch<T>(path: string, init?: { method: "POST"; body: string }): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.TRONGRID_API_KEY) {
    headers["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;
  }

  let res: Response;
  let attempt = 0;
  for (;;) {
    res = await fetch(`${TRONGRID_BASE}${path}`, {
      ...init,
      headers,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (res.status !== 429 || attempt >= 3) break;
    attempt++;
    await sleep(1000 * attempt); // 1с, 2с, 3с
  }
  if (!res.ok) {
    throw new Error(`TronGrid: HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

interface TriggerConstantResponse {
  result?: { result?: boolean; message?: string };
  constant_result?: string[];
}

/**
 * Баланс USDT адреса в micro-единицах (у TRC-20 USDT 6 знаков — совпадает с нашим хранением).
 * Работает и для неактивированных адресов.
 */
export async function fetchUsdtBalance(address: string): Promise<number> {
  // ABI-кодирование аргумента balanceOf: адрес, дополненный нулями до 32 байт.
  const parameter = tronAddressToHex20(address).padStart(64, "0");
  const data = await tronFetch<TriggerConstantResponse>("/wallet/triggerconstantcontract", {
    method: "POST",
    body: JSON.stringify({
      owner_address: address.trim(),
      contract_address: USDT_CONTRACT,
      function_selector: "balanceOf(address)",
      parameter,
      visible: true,
    }),
  });

  const hex = data.constant_result?.[0];
  if (!hex) {
    const message = data.result?.message
      ? Buffer.from(data.result.message, "hex").toString("utf8")
      : "пустой ответ balanceOf";
    throw new Error(`TronGrid: ${message}`);
  }

  const micro = BigInt(`0x${hex}`);
  if (micro > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("TronGrid: баланс превышает безопасный диапазон");
  }
  return Number(micro);
}

interface Trc20TransferRow {
  transaction_id?: string;
  block_timestamp?: number;
  from?: string;
  to?: string;
  value?: string;
  token_info?: { symbol?: string; decimals?: number };
}

interface Trc20TransfersResponse {
  data?: Trc20TransferRow[];
  success?: boolean;
  // Курсор следующей страницы; на последней странице TronGrid его не отдаёт.
  meta?: { fingerprint?: string };
}

/** Строка base-units + число знаков токена -> десятичное число (без потери точности на больших суммах). */
function transferValueToDecimal(value: string, decimals: number): number {
  const base = BigInt(value);
  const divisor = 10n ** BigInt(decimals);
  const whole = base / divisor;
  const frac = base % divisor;
  // Дробную часть добавляем через Number, целую — тоже; суммы USDT далеко в пределах безопасного диапазона.
  return Number(whole) + Number(frac) / Number(divisor);
}

export interface Trc20TransfersQuery {
  limit?: number; // 10 по умолчанию; потолок TronGrid — 200
  fingerprint?: string; // курсор из meta.fingerprint предыдущей страницы
  minTimestamp?: number; // мс от эпохи, включительно
  maxTimestamp?: number;
  orderBy?: "asc" | "desc"; // по времени блока; по умолчанию — как отдаёт TronGrid (убыв.)
}

/**
 * Страница переводов USDT (TRC-20) по адресу через TronGrid REST v1.
 * Фильтр по контракту USDT; только подтверждённые.
 */
export async function fetchUsdtTransfers(
  address: string,
  query: Trc20TransfersQuery = {},
): Promise<Trc20TransfersPage> {
  const addr = address.trim();
  const params = new URLSearchParams({
    limit: String(query.limit ?? 10),
    only_confirmed: "true",
    contract_address: USDT_CONTRACT,
  });
  if (query.fingerprint) params.set("fingerprint", query.fingerprint);
  if (query.minTimestamp !== undefined) params.set("min_timestamp", String(query.minTimestamp));
  if (query.maxTimestamp !== undefined) params.set("max_timestamp", String(query.maxTimestamp));
  if (query.orderBy) params.set("order_by", `block_timestamp,${query.orderBy}`);

  const data = await tronFetch<Trc20TransfersResponse>(
    `/v1/accounts/${addr}/transactions/trc20?${params}`,
  );
  const rows = data.data ?? [];
  const lower = addr.toLowerCase();

  const transfers = rows
    .filter((r) => r.transaction_id && r.value != null && r.from && r.to)
    .map((r) => {
      const decimals = r.token_info?.decimals ?? 6;
      return {
        tx_id: r.transaction_id as string,
        from: r.from as string,
        to: r.to as string,
        amount: transferValueToDecimal(r.value as string, decimals),
        symbol: r.token_info?.symbol ?? "USDT",
        timestamp: r.block_timestamp ?? 0,
        direction: (r.from as string).toLowerCase() === lower ? "out" : "in",
      } satisfies Trc20Transfer;
    });

  return { transfers, next: data.meta?.fingerprint ?? null };
}

/**
 * Все переводы USDT адреса за окно [from, to] (мс от эпохи, обе границы включительно).
 * Идёт по курсору TronGrid до конца окна; `truncated` — упёрлись в потолок страниц
 * (день с таким числом переводов нереален, потолок нужен от бесконечного цикла).
 */
export async function fetchUsdtTransfersInRange(
  address: string,
  from: number,
  to: number,
  opts: { pageLimit?: number; maxPages?: number } = {},
): Promise<{ transfers: Trc20Transfer[]; truncated: boolean }> {
  const pageLimit = opts.pageLimit ?? 200;
  const maxPages = opts.maxPages ?? 3;

  const transfers: Trc20Transfer[] = [];
  let fingerprint: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchUsdtTransfers(address, {
      limit: pageLimit,
      minTimestamp: from,
      maxTimestamp: to,
      orderBy: "asc",
      fingerprint,
    });
    transfers.push(...res.transfers);
    if (!res.next) return { transfers, truncated: false };
    fingerprint = res.next;
  }
  return { transfers, truncated: true };
}

interface GetAccountResponse {
  // Нативный баланс TRX в SUN. Для неактивированного аккаунта TronGrid
  // отдаёт пустой объект {}, поэтому поле необязательное.
  balance?: number | string;
}

/**
 * Баланс нативного TRX адреса в micro-единицах (SUN): у TRX 6 знаков,
 * 1 TRX = 1 000 000 SUN — совпадает с нашим хранением, поэтому возвращаем
 * целое число SUN как есть, без деления.
 *
 * В отличие от USDT нативный баланс читается из самого аккаунта
 * (POST /wallet/getaccount, поле `balance` в SUN), а не через контракт.
 * Для неактивированного/несуществующего адреса TronGrid возвращает пустой
 * объект {} без поля balance — это корректно означает 0 TRX.
 */
export async function fetchTrxBalance(address: string): Promise<number> {
  const data = await tronFetch<GetAccountResponse>("/wallet/getaccount", {
    method: "POST",
    body: JSON.stringify({ address: address.trim(), visible: true }),
  });

  // Неактивированный адрес -> пустой объект {} без balance -> 0 TRX.
  if (data.balance === undefined || data.balance === null) {
    return 0;
  }

  const sun = BigInt(data.balance);
  if (sun > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("TronGrid: баланс превышает безопасный диапазон");
  }
  return Number(sun);
}
