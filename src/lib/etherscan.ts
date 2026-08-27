// История переводов USDT в EVM-сетях через Etherscan API v2 (multichain).
//
// В v2 у Etherscan один общий хост и один ключ на все сети: сеть выбирается
// параметром chainid (1 — Ethereum, 56 — BSC). Ключ обязателен даже на
// бесплатном тарифе, поэтому без ETHERSCAN_API_KEY история по EVM-кошелькам
// недоступна — остальное приложение (балансы, сверка) работает без него.
//
// ВАЖНО: бесплатный тариф покрывает только Ethereum. BSC (chainid 56) на нём
// отдаёт «Free API access is not supported for this chain» — история по
// BSC-кошелькам требует платного плана Etherscan API (см. errorMessage ниже).
//
// Пагинация здесь страничная (page/offset), а не курсорная как у TronGrid,
// поэтому в общий контракт UsdtTransfersPage курсором уезжает номер
// следующей страницы строкой.

import { CHAIN_META } from "@/lib/chains";
import { transferValueToDecimal } from "@/lib/tron";
import type { EvmChain, UsdtTransfer, UsdtTransfersPage } from "@/types";

const BASE_URL = "https://api.etherscan.io/v2/api";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function apiKey(): string {
  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) {
    throw new Error(
      "Не задана переменная ETHERSCAN_API_KEY — история переводов в BSC/Ethereum недоступна",
    );
  }
  return key;
}

interface EtherscanEnvelope<T> {
  status?: string; // "1" — успех, "0" — прикладная ошибка либо пустой результат
  message?: string;
  result?: T | string;
}

/**
 * Запрос к Etherscan v2: таймаут 10с и до 3 повторов на 429/5xx с растущей
 * паузой. Пустая выборка приходит как status "0" с message "No transactions
 * found" — это не ошибка, а нормальный ответ, поэтому обрабатывается отдельно.
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

  let res: Response;
  let attempt = 0;
  for (;;) {
    res = await fetch(`${BASE_URL}?${query}`, {
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if ((res.status !== 429 && res.status < 500) || attempt >= 3) break;
    attempt++;
    await sleep(1000 * attempt); // 1с, 2с, 3с
  }
  if (!res.ok) {
    throw new Error(`Etherscan ${label}: HTTP ${res.status}`);
  }

  const json = (await res.json().catch(() => null)) as EtherscanEnvelope<T> | null;
  if (!json) {
    throw new Error(`Etherscan ${label}: некорректный ответ`);
  }
  return json;
}

/** Список строк из ответа. Пустая выборка — не ошибка, а нормальный ответ. */
async function esList<T>(chain: EvmChain, params: Record<string, string>): Promise<T[]> {
  const json = await esRequest<T[]>(chain, params);
  if (Array.isArray(json.result)) return json.result;
  if (json.status === "0" && /no (transactions|records) found/i.test(String(json.result ?? ""))) {
    return [];
  }
  throw new Error(errorMessage(chain, json));
}

/** Русское сообщение об ошибке API: типовые ответы Etherscan разворачиваем в понятные. */
function errorMessage(chain: EvmChain, json: EtherscanEnvelope<unknown>): string {
  const raw = String(json.result ?? json.message ?? "ошибка запроса");
  const label = CHAIN_META[chain].label;
  if (/not supported for this chain/i.test(raw)) {
    return `Etherscan: история ${label} недоступна на бесплатном тарифе — нужен платный план Etherscan API`;
  }
  if (/missing\/invalid api key/i.test(raw)) {
    return "Etherscan: ключ ETHERSCAN_API_KEY отсутствует или неверен";
  }
  return `Etherscan ${label}: ${raw}`;
}

interface TokenTxRow {
  hash?: string;
  from?: string;
  to?: string;
  value?: string;
  tokenSymbol?: string;
  tokenDecimal?: string;
  timeStamp?: string; // секунды от эпохи
}

function toTransfers(rows: TokenTxRow[], address: string, chain: EvmChain): UsdtTransfer[] {
  const lower = address.trim().toLowerCase();
  return rows
    .filter((r) => r.hash && r.value != null && r.from && r.to)
    .map((r) => ({
      tx_id: r.hash as string,
      from: r.from as string,
      to: r.to as string,
      amount: transferValueToDecimal(
        r.value as string,
        Number(r.tokenDecimal ?? CHAIN_META[chain].usdtDecimals),
      ),
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
  const rows = await esList<TokenTxRow>(chain, {
    module: "account",
    action: "tokentx",
    contractaddress: CHAIN_META[chain].usdtContract,
    address: address.trim(),
    page: String(page),
    offset: String(limit),
    sort: "desc",
  });
  return {
    transfers: toTransfers(rows, address, chain),
    next: rows.length < limit ? null : String(page + 1),
  };
}

/**
 * Номер блока, ближайшего к моменту времени (мс от эпохи) с нужной стороны.
 * Ответ приходит строкой в `result`. null — Etherscan не смог определить блок
 * (например, окно в будущем): вызывающий подставит открытую границу.
 */
async function blockNumberByTime(
  chain: EvmChain,
  timestampMs: number,
  closest: "before" | "after",
): Promise<number | null> {
  const json = await esRequest<string>(chain, {
    module: "block",
    action: "getblocknobytime",
    timestamp: String(Math.floor(timestampMs / 1000)),
    closest,
  }).catch(() => null);
  const block = Number(json?.result);
  return json?.status === "1" && Number.isInteger(block) ? block : null;
}

/**
 * Все переводы USDT адреса за окно [from, to] (мс от эпохи, обе границы
 * включительно). Etherscan фильтрует по блокам, поэтому границы окна сначала
 * переводятся в номера блоков, а затем результат ещё раз просеивается по
 * точному времени. `truncated` — упёрлись в потолок страниц.
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
  const [startblock, endblock] = await Promise.all([
    blockNumberByTime(chain, from, "after"),
    blockNumberByTime(chain, to, "before"),
  ]);

  const transfers: UsdtTransfer[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const rows = await esList<TokenTxRow>(chain, {
      module: "account",
      action: "tokentx",
      contractaddress: CHAIN_META[chain].usdtContract,
      address: address.trim(),
      startblock: String(startblock ?? 0),
      endblock: String(endblock ?? 99999999),
      page: String(page),
      offset: String(pageLimit),
      sort: "asc",
    });
    // Границы блоков приблизительные (блок мог попасть на край окна) —
    // отсекаем по фактическому времени перевода.
    transfers.push(
      ...toTransfers(rows, address, chain).filter((t) => t.timestamp >= from && t.timestamp <= to),
    );
    if (rows.length < pageLimit) return { transfers, truncated: false };
  }
  return { transfers, truncated: true };
}
