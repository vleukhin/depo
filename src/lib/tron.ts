// Получение баланса USDT (TRC-20) в сети TRON через TronGrid.
//
// Баланс читается вызовом balanceOf(address) на контракте USDT
// (triggerconstantcontract), а не через /v1/accounts/{address}:
// эндпоинт аккаунтов отдаёт пустые данные для неактивированных адресов,
// хотя USDT на них уже может лежать — балансы TRC-20 хранятся в самом
// контракте и не зависят от активации аккаунта.

import { createHash } from "node:crypto";
import type { Trc20Transfer } from "@/types";

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

// --- запрос баланса ---

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface TriggerConstantResponse {
  result?: { result?: boolean; message?: string };
  constant_result?: string[];
}

/**
 * Баланс USDT адреса в micro-единицах (у TRC-20 USDT 6 знаков — совпадает с нашим хранением).
 * Работает и для неактивированных адресов. На 429 — до 3 повторов с растущей паузой.
 */
export async function fetchUsdtBalance(address: string): Promise<number> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.TRONGRID_API_KEY) {
    headers["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;
  }

  // ABI-кодирование аргумента balanceOf: адрес, дополненный нулями до 32 байт.
  const parameter = tronAddressToHex20(address).padStart(64, "0");
  const body = JSON.stringify({
    owner_address: address.trim(),
    contract_address: USDT_CONTRACT,
    function_selector: "balanceOf(address)",
    parameter,
    visible: true,
  });

  let res: Response;
  let attempt = 0;
  for (;;) {
    res = await fetch("https://api.trongrid.io/wallet/triggerconstantcontract", {
      method: "POST",
      headers,
      body,
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

  const data = (await res.json()) as TriggerConstantResponse;
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

/**
 * Последние `limit` переводов USDT (TRC-20) по адресу через TronGrid REST v1.
 * Фильтр по контракту USDT; только подтверждённые. На 429 — до 3 повторов с растущей паузой.
 */
export async function fetchUsdtTransfers(address: string, limit = 10): Promise<Trc20Transfer[]> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.TRONGRID_API_KEY) {
    headers["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;
  }

  const addr = address.trim();
  const url =
    `https://api.trongrid.io/v1/accounts/${addr}/transactions/trc20` +
    `?limit=${limit}&only_confirmed=true&contract_address=${USDT_CONTRACT}`;

  let res: Response;
  let attempt = 0;
  for (;;) {
    res = await fetch(url, {
      method: "GET",
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

  const data = (await res.json()) as Trc20TransfersResponse;
  const rows = data.data ?? [];
  const lower = addr.toLowerCase();

  return rows
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
 * объект {} без поля balance — это корректно означает 0 TRX. На 429 —
 * до 3 повторов с растущей паузой.
 */
export async function fetchTrxBalance(address: string): Promise<number> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.TRONGRID_API_KEY) {
    headers["TRON-PRO-API-KEY"] = process.env.TRONGRID_API_KEY;
  }

  const body = JSON.stringify({ address: address.trim(), visible: true });

  let res: Response;
  let attempt = 0;
  for (;;) {
    res = await fetch("https://api.trongrid.io/wallet/getaccount", {
      method: "POST",
      headers,
      body,
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

  const data = (await res.json()) as GetAccountResponse;
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
