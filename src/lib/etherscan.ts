// История переводов USDT в Arbitrum через Etherscan API v2 (multichain).
//
// BSC и Ethereum читаются через NodeReal (lib/nodereal.ts), но его
// nr_getTransactionByAddress есть только для этих двух сетей. У Etherscan v2,
// наоборот, Arbitrum One (chainid 42161) входит в бесплатный тариф — в отличие
// от BSC, ради которой с Etherscan когда-то и ушли. Ключ обязателен даже на
// бесплатном тарифе: без ETHERSCAN_API_KEY история Arbitrum-кошельков
// недоступна, а балансы и сверка работают и без него.
//
// Пагинация страничная (page/offset), поэтому курсором в общий контракт
// UsdtTransfersPage уезжает номер следующей страницы строкой. Окно по времени
// читается от свежих к старым с ранним выходом, без перевода времени в номер
// блока — так же, как у NodeReal.

import { CHAIN_META } from "@/lib/chains";
import { transferValueToDecimal } from "@/lib/tron";
import type { EvmChain, UsdtTransfer, UsdtTransfersPage } from "@/types";

const BASE_URL = "https://api.etherscan.io/v2/api";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function apiKey(): string {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) {
    throw new Error(
      "Не задана переменная ETHERSCAN_API_KEY — история переводов в Arbitrum недоступна",
    );
  }
  return key;
}

interface EtherscanEnvelope<T> {
  status?: string; // "1" — успех, "0" — прикладная ошибка либо пустой результат
  message?: string;
  result?: T | string;
}

// Превышение лимита бесплатного тарифа (3 запроса/с) приходит не 429-м, а
// обычным HTTP 200 со status "0" — повторяем его так же, как 429.
const isRateLimited = (json: EtherscanEnvelope<unknown> | null) =>
  json?.status === "0" && /rate limit/i.test(String(json.result ?? json.message ?? ""));

/**
 * Запрос к Etherscan v2: таймаут 10с и до 3 повторов на 429/5xx/лимит тарифа
 * с растущей паузой — та же политика, что у остальных внешних клиентов проекта.
 */
async function esRequest<T>(
  chain: EvmChain,
  params: Record<string, string>,
): Promise<EtherscanEnvelope<T>> {
  const label = CHAIN_META[chain].label;
  const query = new URLSearchParams({
    chainid: String(CHAIN_META[chain].evmChainId),
    ...params,
    apikey: apiKey(),
  });

  let attempt = 0;
  for (;;) {
    const res = await fetch(`${BASE_URL}?${query}`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const retryable = res.status === 429 || res.status >= 500;
    // Ключ лежит в query — в сообщение об ошибке URL попасть не должен.
    if (!res.ok && (!retryable || attempt >= 3)) {
      throw new Error(`Etherscan ${label}: HTTP ${res.status}`);
    }
    const json = res.ok
      ? ((await res.json().catch(() => null)) as EtherscanEnvelope<T> | null)
      : null;
    if (res.ok && !isRateLimited(json)) {
      if (!json) throw new Error(`Etherscan ${label}: некорректный ответ`);
      return json;
    }
    if (attempt >= 3) {
      throw new Error(`Etherscan ${label}: превышен лимит запросов тарифа`);
    }
    attempt++;
    await sleep(1000 * attempt); // 1с, 2с, 3с
  }
}

/** Русское сообщение об ошибке API: типовые ответы Etherscan разворачиваем в понятные. */
function errorMessage(chain: EvmChain, json: EtherscanEnvelope<unknown>): string {
  const raw = String(json.result ?? json.message ?? "ошибка запроса");
  const label = CHAIN_META[chain].label;
  if (/not supported for this chain/i.test(raw)) {
    return `Etherscan: история ${label} недоступна на бесплатном тарифе — нужен платный план Etherscan API`;
  }
  if (/missing\/invalid api key|invalid api key/i.test(raw)) {
    return "Etherscan: ключ ETHERSCAN_API_KEY отсутствует или неверен";
  }
  return `Etherscan ${label}: ${raw}`;
}

interface TokenTxRow {
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  contractAddress?: string;
  tokenSymbol?: string;
  timeStamp?: string; // секунды от эпохи
}

/** Страница tokentx по контракту USDT сети, свежие сверху. Пустая выборка — не ошибка. */
async function fetchPage(
  chain: EvmChain,
  address: string,
  page: number,
  offset: number,
): Promise<TokenTxRow[]> {
  const json = await esRequest<TokenTxRow[]>(chain, {
    module: "account",
    action: "tokentx",
    contractaddress: CHAIN_META[chain].usdtContract,
    address: address.trim(),
    page: String(page),
    offset: String(offset),
    sort: "desc",
  });
  if (Array.isArray(json.result)) return json.result;
  if (json.status === "0" && /no (transactions|records) found/i.test(String(json.result ?? json.message ?? ""))) {
    return [];
  }
  throw new Error(errorMessage(chain, json));
}

/**
 * Строки ответа -> переводы USDT. Контракт уже задан в запросе, но строки всё
 * равно сверяются с ним: по этим переводам заводят долги, и фантик с тикером
 * USDT в историю попасть не должен. Число знаков — из CHAIN_META, а не из ответа.
 */
function toTransfers(rows: TokenTxRow[], address: string, chain: EvmChain): UsdtTransfer[] {
  const lower = address.trim().toLowerCase();
  const usdt = CHAIN_META[chain].usdtContract.toLowerCase();
  return rows
    .filter(
      (r) =>
        r.hash &&
        r.from &&
        r.to &&
        /^\d+$/.test(r.value ?? "") &&
        r.contractAddress?.toLowerCase() === usdt,
    )
    .map((r) => ({
      tx_id: r.hash as string,
      from: r.from as string,
      to: r.to as string,
      amount: transferValueToDecimal(r.value as string, CHAIN_META[chain].usdtDecimals),
      symbol: r.tokenSymbol ?? "USDT",
      timestamp: Number(r.timeStamp ?? 0) * 1000,
      direction: (r.from as string).toLowerCase() === lower ? "out" : "in",
    }));
}

/**
 * Страница переводов USDT по адресу, свежие сверху. `next` — номер следующей
 * страницы строкой; null, когда пришло меньше запрошенного (страница последняя).
 */
export async function fetchUsdtTransfers(
  chain: EvmChain,
  address: string,
  query: { limit?: number; page?: string } = {},
): Promise<UsdtTransfersPage> {
  const limit = query.limit ?? 10;
  const page = Number(query.page ?? 1) || 1;
  const rows = await fetchPage(chain, address, page, limit);
  return {
    transfers: toTransfers(rows, address, chain),
    next: rows.length < limit ? null : String(page + 1),
  };
}

/**
 * Все переводы USDT адреса за окно [from, to] (мс от эпохи, обе границы
 * включительно). Страницы читаются от свежих к старым с ранним выходом, как
 * только выборка ушла ниже нижней границы окна. `truncated` — упёрлись в
 * потолок страниц.
 */
export async function fetchUsdtTransfersInRange(
  chain: EvmChain,
  address: string,
  from: number,
  to: number,
  opts: { pageLimit?: number; maxPages?: number } = {},
): Promise<{ transfers: UsdtTransfer[]; truncated: boolean }> {
  const pageLimit = opts.pageLimit ?? 200;
  const maxPages = opts.maxPages ?? 3;

  const transfers: UsdtTransfer[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const rows = await fetchPage(chain, address, page, pageLimit);
    const batch = toTransfers(rows, address, chain);
    transfers.push(...batch.filter((t) => t.timestamp >= from && t.timestamp <= to));
    // Порядок убывающий: страница с переводом старее окна — последняя нужная.
    if (rows.length < pageLimit || batch.some((t) => t.timestamp < from)) {
      return { transfers, truncated: false };
    }
  }
  return { transfers, truncated: true };
}
