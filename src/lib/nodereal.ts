// История переводов USDT в EVM-сетях через NodeReal MegaNode (BSCTrace).
//
// Заменил Etherscan API v2: с 18.12.2025 BSC выведена из бесплатного тарифа
// Etherscan («Free API access is not supported for this chain»), и история по
// BEP-20 требовала платного плана. NodeReal — та замена, которую предлагает сам
// BNB Chain взамен отключённого BscScan API; бесплатного тарифа (3M CU в сутки)
// с запасом хватает на одного пользователя. Один ключ обслуживает и BSC, и
// Ethereum — эндпоинт различается поддоменом (`noderealNetwork` в CHAIN_META).
//
// Метод — nr_getTransactionByAddress: адресо-центричный аналог bscscan'овского
// `account&action=tokentx`, с курсорной пагинацией (`pageKey`) и временем блока
// прямо в строке. Соседний nr_getAssetTransfers сюда не годится: у него окно
// ограничено 1000 блоками, а это ~7 минут жизни BSC — ни «последние 10
// переводов», ни сутки в него не помещаются.
//
// Границы окна в блоках не запрашиваются вовсе: страницы читаются от свежих к
// старым с ранним выходом по времени. Это снимает и лимит на ширину окна, и
// необходимость переводить время в номер блока.

import { CHAIN_META } from "@/lib/chains";
import { transferValueToDecimal } from "@/lib/tron";
import type { EvmChain, UsdtTransfer, UsdtTransfersPage } from "@/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function apiKey(): string {
  const key = process.env.NODEREAL_API_KEY;
  if (!key) {
    throw new Error(
      "Не задана переменная NODEREAL_API_KEY — история переводов в BSC/Ethereum недоступна",
    );
  }
  return key;
}

function endpoint(chain: EvmChain): string {
  const network = CHAIN_META[chain].noderealNetwork;
  return `https://${network}.nodereal.io/v1/${apiKey()}`;
}

interface JsonRpcResponse<T> {
  result?: T;
  error?: { code?: number; message?: string };
}

/**
 * JSON-RPC-запрос к MegaNode: таймаут 10с и до 3 повторов на 429/5xx с растущей
 * паузой — та же политика, что у остальных внешних клиентов проекта.
 */
async function nrRequest<T>(
  chain: EvmChain,
  method: string,
  params: unknown[],
): Promise<T> {
  const label = CHAIN_META[chain].label;
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });

  let res: Response;
  let attempt = 0;
  for (;;) {
    res = await fetch(endpoint(chain), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if ((res.status !== 429 && res.status < 500) || attempt >= 3) break;
    attempt++;
    await sleep(1000 * attempt); // 1с, 2с, 3с
  }
  if (!res.ok) {
    // Ключ NodeReal лежит в пути URL — в сообщение он попасть не должен.
    throw new Error(`NodeReal ${label}: HTTP ${res.status}`);
  }

  const json = (await res.json().catch(() => null)) as JsonRpcResponse<T> | null;
  if (!json) {
    throw new Error(`NodeReal ${label}: некорректный ответ`);
  }
  if (json.error) {
    throw new Error(errorMessage(chain, json.error));
  }
  if (json.result == null) {
    throw new Error(`NodeReal ${label}: пустой ответ`);
  }
  return json.result;
}

/** Русское сообщение об ошибке API: типовые ответы разворачиваем в понятные. */
function errorMessage(chain: EvmChain, error: { code?: number; message?: string }): string {
  const raw = error.message ?? "ошибка запроса";
  const label = CHAIN_META[chain].label;
  if (/api key|unauthorized|forbidden/i.test(raw)) {
    return "NodeReal: ключ NODEREAL_API_KEY отсутствует или неверен";
  }
  if (/quota|limit|exceed/i.test(raw)) {
    return `NodeReal ${label}: исчерпан лимит запросов тарифа`;
  }
  return `NodeReal ${label}: ${raw}`;
}

interface TransferRow {
  category?: string;
  blockNum?: string;
  from?: string;
  to?: string;
  value?: string;
  asset?: string;
  hash?: string;
  blockTimeStamp?: number | string; // секунды от эпохи
  // Адрес контракта токена: в ответах NodeReal встречается под разными именами,
  // поэтому читается через contractOf() — от него зависит отбор именно USDT.
  contractAddress?: string;
  contract?: string;
  tokenAddress?: string;
  rawContract?: { address?: string };
}

interface TransfersResult {
  transfers?: TransferRow[];
  pageKey?: string;
}

/**
 * Адрес контракта токена из строки ответа. Отбор идёт именно по нему, а не по
 * тикеру: в BSC полно «USDT», отчеканенных кем угодно, и перевод такого фантика
 * не должен попасть в историю — по нему тут заводят долги.
 */
function contractOf(row: TransferRow): string | null {
  const raw = row.contractAddress ?? row.contract ?? row.tokenAddress ?? row.rawContract?.address;
  return typeof raw === "string" && raw ? raw.trim().toLowerCase() : null;
}

/** Время блока (секунды или ISO-строка) -> мс от эпохи; 0, если поля нет. */
function timestampOf(row: TransferRow): number {
  const raw = row.blockTimeStamp;
  if (typeof raw === "number") return raw * 1000;
  if (typeof raw === "string" && raw) {
    const seconds = Number(raw.startsWith("0x") ? BigInt(raw) : raw);
    if (Number.isFinite(seconds)) return seconds * 1000;
    const parsed = Date.parse(raw);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

/**
 * Сумма перевода в десятичных USDT. `value` приходит в базовых единицах токена
 * (у BSC-USD их 18, у ERC-20 USDT — 6); hex-строка распознаётся по префиксу.
 * Число знаков берём из CHAIN_META, а не из ответа: контракт уже отобран, так
 * что это надёжнее любого поля.
 */
function amountOf(row: TransferRow, chain: EvmChain): number {
  const raw = String(row.value ?? "").trim();
  const base = raw.startsWith("0x") ? BigInt(raw).toString() : raw;
  if (!/^\d+$/.test(base)) {
    throw new Error(`NodeReal ${CHAIN_META[chain].label}: нераспознанная сумма перевода «${raw}»`);
  }
  return transferValueToDecimal(base, CHAIN_META[chain].usdtDecimals);
}

/**
 * Строки ответа -> переводы USDT. Всё, что не по контракту USDT этой сети,
 * отсеивается: nr_getTransactionByAddress фильтрует по адресу кошелька и
 * категории токена, но не по конкретному контракту.
 */
function toTransfers(rows: TransferRow[], address: string, chain: EvmChain): UsdtTransfer[] {
  const lower = address.trim().toLowerCase();
  const usdt = CHAIN_META[chain].usdtContract.toLowerCase();

  // Ответ без адреса контракта отобрать по USDT нельзя — молча пропускать такие
  // строки нельзя тем более, поэтому падаем с сообщением, а не выдаём чужое.
  if (rows.length > 0 && rows.every((r) => contractOf(r) === null)) {
    throw new Error(
      `NodeReal ${CHAIN_META[chain].label}: в ответе нет адреса контракта токена ` +
        `(поля: ${Object.keys(rows[0]).join(", ")}) — отобрать переводы USDT невозможно`,
    );
  }

  return rows
    .filter((r) => r.hash && r.value != null && r.from && r.to && contractOf(r) === usdt)
    .map((r) => ({
      tx_id: r.hash as string,
      from: r.from as string,
      to: r.to as string,
      amount: amountOf(r, chain),
      symbol: r.asset ?? "USDT",
      timestamp: timestampOf(r),
      direction: (r.from as string).toLowerCase() === lower ? "out" : "in",
    }));
}

/** Одна страница nr_getTransactionByAddress, свежие сверху. */
async function fetchPage(
  chain: EvmChain,
  address: string,
  maxCount: number,
  pageKey?: string,
): Promise<{ rows: TransferRow[]; pageKey: string | null }> {
  const params: Record<string, unknown> = {
    category: ["20"], // только переводы токенов ERC-20/BEP-20
    address: address.trim(),
    addressType: null, // и входящие, и исходящие
    order: "desc",
    maxCount: `0x${maxCount.toString(16)}`,
  };
  if (pageKey) params.pageKey = pageKey;

  const result = await nrRequest<TransfersResult>(chain, "nr_getTransactionByAddress", [params]);
  return { rows: result.transfers ?? [], pageKey: result.pageKey || null };
}

/**
 * Страница переводов USDT по адресу, свежие сверху. `next` — pageKey источника.
 *
 * Запрашиваем с запасом: страница фильтруется по контракту USDT уже у нас, и
 * без запаса кошелёк, у которого на балансе висит десяток посторонних токенов,
 * отдал бы почти пустой список при непустом курсоре. Обрезать результат до
 * `limit` при этом нельзя: курсор источника уже перешагнул всю выборку, и
 * отрезанные переводы не вернулись бы ни на одной следующей странице.
 */
export async function fetchUsdtTransfers(
  chain: EvmChain,
  address: string,
  query: { limit?: number; page?: string } = {},
): Promise<UsdtTransfersPage> {
  const limit = query.limit ?? 10;
  const { rows, pageKey } = await fetchPage(chain, address, Math.min(limit * 10, 1000), query.page);
  return { transfers: toTransfers(rows, address, chain), next: pageKey };
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
  const pageLimit = opts.pageLimit ?? 1000; // потолок maxCount у NodeReal (0x3E8)
  const maxPages = opts.maxPages ?? 3;

  const transfers: UsdtTransfer[] = [];
  let pageKey: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchPage(chain, address, pageLimit, pageKey);
    const batch = toTransfers(res.rows, address, chain);
    transfers.push(...batch.filter((t) => t.timestamp >= from && t.timestamp <= to));
    // Порядок убывающий: страница с переводом старее окна — последняя нужная.
    // Сравниваем по всем строкам ответа, а не только по отобранным USDT: чужой
    // токен так же отмеряет, докуда дочитали.
    const oldest = res.rows.reduce((min, r) => Math.min(min, timestampOf(r) || Infinity), Infinity);
    if (!res.pageKey || oldest < from) return { transfers, truncated: false };
    pageKey = res.pageKey;
  }
  return { transfers, truncated: true };
}
