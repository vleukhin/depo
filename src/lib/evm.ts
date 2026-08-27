// Балансы USDT и нативной монеты (BNB/ETH) в EVM-сетях через публичный JSON-RPC.
//
// Никаких библиотек: оба запроса — это два готовых метода RPC. Баланс токена
// читается вызовом balanceOf(address) через eth_call (селектор 0x70a08231),
// нативный — eth_getBalance. Числа приходят hex-строками произвольной длины,
// поэтому разбираются BigInt'ом и масштабируются в micro-единицы уже из него:
// у BEP-20 USDT и у BNB/ETH по 18 знаков — Number такие значения не выдержит.

import { CHAIN_META } from "@/lib/chains";
import { baseUnitsToMicro } from "@/lib/money";
import type { EvmChain } from "@/types";

// Публичные ноды без ключа; при необходимости подменяются своим провайдером
// (Alchemy/QuickNode/собственная нода) через переменные окружения.
const DEFAULT_RPC: Record<EvmChain, string> = {
  bsc: "https://bsc-rpc.publicnode.com",
  ethereum: "https://ethereum-rpc.publicnode.com",
};

function rpcUrl(chain: EvmChain): string {
  const override = chain === "bsc" ? process.env.BSC_RPC_URL : process.env.ETH_RPC_URL;
  return override?.trim() || DEFAULT_RPC[chain];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface JsonRpcResponse {
  result?: string;
  error?: { message?: string };
}

/**
 * JSON-RPC вызов к ноде сети: таймаут 10с и до 3 повторов на 429/5xx
 * с растущей паузой (публичные ноды периодически отвечают отказом).
 * Запрос идёт напрямую — прокси в проекте только для бирж.
 */
async function rpc(chain: EvmChain, method: string, params: unknown[]): Promise<string> {
  const label = CHAIN_META[chain].label;
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });

  let res: Response;
  let attempt = 0;
  for (;;) {
    res = await fetch(rpcUrl(chain), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if ((res.status !== 429 && res.status < 500) || attempt >= 3) break;
    attempt++;
    await sleep(1000 * attempt); // 1с, 2с, 3с
  }
  if (!res.ok) {
    throw new Error(`RPC ${label}: HTTP ${res.status}`);
  }

  const json = (await res.json().catch(() => null)) as JsonRpcResponse | null;
  if (!json || json.error || typeof json.result !== "string") {
    throw new Error(`RPC ${label}: ${json?.error?.message ?? "некорректный ответ"}`);
  }
  return json.result;
}

/** hex-строка ответа RPC -> BigInt; пустой результат («0x») означает ноль. */
function hexToBigInt(hex: string, chain: EvmChain): bigint {
  if (!/^0x[0-9a-fA-F]*$/.test(hex)) {
    throw new Error(`RPC ${CHAIN_META[chain].label}: некорректное число в ответе`);
  }
  return hex.length <= 2 ? 0n : BigInt(hex);
}

/** Баланс USDT адреса в micro-единицах (учитывая, что в BSC у USDT 18 знаков). */
export async function fetchUsdtBalance(chain: EvmChain, address: string): Promise<number> {
  const meta = CHAIN_META[chain];
  // ABI-кодирование balanceOf: селектор + адрес без 0x, дополненный нулями до 32 байт.
  const data = `0x70a08231${address.trim().slice(2).toLowerCase().padStart(64, "0")}`;
  const hex = await rpc(chain, "eth_call", [{ to: meta.usdtContract, data }, "latest"]);
  return baseUnitsToMicro(hexToBigInt(hex, chain), meta.usdtDecimals);
}

/** Баланс нативной монеты (BNB/ETH) адреса в micro-единицах. */
export async function fetchNativeBalance(chain: EvmChain, address: string): Promise<number> {
  const hex = await rpc(chain, "eth_getBalance", [address.trim(), "latest"]);
  return baseUnitsToMicro(hexToBigInt(hex, chain), CHAIN_META[chain].nativeDecimals);
}
