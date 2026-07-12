// Получение баланса USDT (TRC-20) в сети TRON через TronGrid.
//
// Баланс читается вызовом balanceOf(address) на контракте USDT
// (triggerconstantcontract), а не через /v1/accounts/{address}:
// эндпоинт аккаунтов отдаёт пустые данные для неактивированных адресов,
// хотя USDT на них уже может лежать — балансы TRC-20 хранятся в самом
// контракте и не зависят от активации аккаунта.

import { createHash } from "node:crypto";

const USDT_CONTRACT = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";
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
