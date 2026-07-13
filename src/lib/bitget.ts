// Взаимодействие с REST API биржи Bitget (API v2).
//
// Приватные запросы подписываются:
//   ACCESS-SIGN       = base64(HMAC-SHA256(secret, timestamp + METHOD + endpoint + body))
//   ACCESS-PASSPHRASE = passphrase открытым текстом (в отличие от KuCoin v2 — без подписи)
// Для GET endpoint включает query-строку: ключи отсортированы по алфавиту и не
// URL-кодируются — ровно так строит её официальный SDK Bitget, а подписанная
// строка обязана совпадать с фактическим путём запроса.
//
// Модуль намеренно ничего не знает о сущностях приложения (funds/placements/БД) —
// это чистый клиент биржи. Достаточно ключа с правом Read-only.

import { createHmac, randomUUID } from "node:crypto";

import type { Dispatcher } from "undici";

import { decimalToMicro } from "@/lib/money";
import { getExchangeDispatcher } from "@/lib/proxy";

const BASE_URL = process.env.BITGET_API_URL ?? "https://api.bitget.com";
const OK_CODE = "00000"; // прикладной «успех» в конверте ответа

const hmac = (secret: string, payload: string): string =>
  createHmac("sha256", secret).update(payload).digest("base64");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function credentials(): { key: string; secret: string; passphrase: string } {
  const key = process.env.BITGET_API_KEY;
  const secret = process.env.BITGET_API_SECRET;
  const passphrase = process.env.BITGET_API_PASSPHRASE;
  if (!key || !secret || !passphrase) {
    throw new Error(
      "Не заданы переменные BITGET_API_KEY / BITGET_API_SECRET / BITGET_API_PASSPHRASE",
    );
  }
  return { key, secret, passphrase };
}

type QueryParams = Record<string, string | number | undefined>;

/**
 * Собирает query-строку как официальный SDK Bitget: ключи по алфавиту, значения
 * без URL-кодирования (параметры здесь — простые алфавитно-цифровые значения).
 * Пусто -> "".
 */
function buildQuery(params: QueryParams = {}): string {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`);
  return pairs.length ? `?${pairs.join("&")}` : "";
}

interface BitgetEnvelope<T> {
  code: string;
  msg?: string;
  data?: T;
}

/**
 * Подписанный приватный запрос к Bitget; возвращает поле `data` из ответа.
 * Прикладной статус проверяется по `code` в конверте, а не только по HTTP.
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
        "ACCESS-KEY": key,
        "ACCESS-TIMESTAMP": timestamp,
        "ACCESS-SIGN": hmac(secret, timestamp + method + endpoint + body),
        "ACCESS-PASSPHRASE": passphrase,
        "Content-Type": "application/json",
        locale: "en-US",
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

  const json = (await res.json().catch(() => null)) as BitgetEnvelope<T> | null;
  if (!res.ok || !json || json.code !== OK_CODE) {
    throw new Error(`Bitget: ${json?.msg ?? `HTTP ${res.status}`}`);
  }
  if (json.data === undefined) {
    throw new Error("Bitget: пустой ответ");
  }
  return json.data;
}

// ================= БАЛАНСЫ =================

export interface BitgetSpotAsset {
  coin: string;
  available: string; // суммы Bitget отдаёт строками; десятичный разбор — на стороне вызывающего
  frozen: string;
  locked: string;
  limitAvailable: string;
  uTime: string;
}

/**
 * Балансы спотового счёта: GET /api/v2/spot/account/assets.
 * Фильтры: по монете и по составу выборки (`hold_only` — только ненулевые, по умолчанию; `all`).
 */
export function fetchSpotAssets(
  filter: { coin?: string; assetType?: "hold_only" | "all" } = {},
): Promise<BitgetSpotAsset[]> {
  return signedRequest<BitgetSpotAsset[]>("GET", "/api/v2/spot/account/assets", {
    query: filter,
  });
}

export interface BitgetFundingAsset {
  coin: string;
  available: string; // суммы Bitget отдаёт строками; поле может быть пустой строкой
  frozen: string;
  usdtValue: string; // оценка актива в USDT
}

/**
 * Балансы funding-счёта: GET /api/v2/account/funding-assets.
 * Без фильтра по монете возвращает все монеты счёта.
 */
export function fetchFundingAssets(
  filter: { coin?: string } = {},
): Promise<BitgetFundingAsset[]> {
  return signedRequest<BitgetFundingAsset[]>("GET", "/api/v2/account/funding-assets", {
    query: filter,
  });
}

/**
 * Десятичная строка суммы -> micro-USDT; пустую строку или отсутствующее поле
 * Bitget использует вместо нуля (например, `frozen: ""` на funding-счёте).
 */
function fieldToMicro(value: string | undefined): number {
  return value === undefined || value.trim() === "" ? 0 : decimalToMicro(value);
}

/**
 * Суммарный баланс произвольной монеты (включая замороженное и заблокированное)
 * на счёте указанного типа, в целых micro-единицах (монета × 1 000 000).
 * `spot` — спотовый счёт (available + frozen + locked),
 * `main` — funding-счёт Bitget (available + frozen). Если активов нет — 0.
 */
async function fetchCoinBalanceMicro(coin: string, account: "spot" | "main"): Promise<number> {
  if (account === "spot") {
    // `assetType: "all"` — иначе Bitget скрывает монеты с нулевым балансом
    const assets = await fetchSpotAssets({ coin, assetType: "all" });
    return assets
      .filter((a) => a.coin === coin)
      .reduce(
        (sum, a) => sum + fieldToMicro(a.available) + fieldToMicro(a.frozen) + fieldToMicro(a.locked),
        0,
      );
  }
  const assets = await fetchFundingAssets({ coin });
  return assets
    .filter((a) => a.coin === coin)
    .reduce((sum, a) => sum + fieldToMicro(a.available) + fieldToMicro(a.frozen), 0);
}

/**
 * Суммарный баланс USDT (включая замороженное и заблокированное) на счёте
 * указанного типа, в целых micro-USDT. `spot` — спотовый счёт,
 * `main` — funding-счёт Bitget. Если активов нет — 0.
 */
export function fetchUsdtBalanceMicro(account: "spot" | "main"): Promise<number> {
  return fetchCoinBalanceMicro("USDT", account);
}

/**
 * Суммарный баланс TRX (включая замороженное и заблокированное) на счёте
 * указанного типа, в целых micro-TRX (TRX × 1 000 000). `spot` — спотовый счёт,
 * `main` — funding-счёт Bitget. У TRX 6 знаков после запятой — как у USDT.
 * Если активов нет — 0.
 */
export function fetchTrxBalanceMicro(account: "spot" | "main"): Promise<number> {
  return fetchCoinBalanceMicro("TRX", account);
}

export interface BitgetAccountBalance {
  accountType: string; // spot / futures / funding / earn / bot / margin ...
  usdtBalance: string; // оценка счёта в USDT
}

/** Сводка по всем типам счетов в USDT: GET /api/v2/account/all-account-balance. */
export function fetchAllAccountBalances(): Promise<BitgetAccountBalance[]> {
  return signedRequest<BitgetAccountBalance[]>("GET", "/api/v2/account/all-account-balance");
}

// ================= КУРС TRX =================

/**
 * Текущий курс TRX/USDT (≈ USD) по публичному спотовому тикеру.
 * Запрос не подписывается: публичные endpoint'ы не проверяют ни ключ,
 * ни IP-whitelist (подписанный запрос с не-whitelisted IP Bitget отвергает).
 * Прокси и таймаут — те же, что у приватных запросов.
 */
export async function fetchTrxUsdtPrice(): Promise<number> {
  const res = await fetch(`${BASE_URL}/api/v2/spot/market/tickers?symbol=TRXUSDT`, {
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
    // dispatcher — опция undici, см. signedRequest.
    dispatcher: getExchangeDispatcher(),
  } as RequestInit & { dispatcher?: Dispatcher });
  const json = (await res.json().catch(() => null)) as BitgetEnvelope<{ lastPr: string }[]> | null;
  if (!res.ok || !json || json.code !== OK_CODE) {
    throw new Error(`Bitget: ${json?.msg ?? `HTTP ${res.status}`}`);
  }
  const price = Number(json.data?.[0]?.lastPr);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Bitget: не удалось получить курс TRX");
  }
  return price;
}

// ================= ВЫВОД TRX =================

interface BitgetCoinChain {
  chain: string; // имя сети, напр. "TRX" (TRON)
  withdrawable?: string; // "true" / "false"
  withdrawFee?: string; // комиссия сети за вывод
  minWithdrawAmount?: string; // минимальная сумма вывода
}

interface BitgetCoin {
  coin: string;
  chains: BitgetCoinChain[];
}

const toNumberOrNull = (value: string | undefined): number | null => {
  if (value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Параметры вывода TRX в сети TRON: GET /api/v2/spot/public/coins?coin=TRX.
 * Из списка сетей монеты берём запись сети TRON (обычно `chain === "TRX"`),
 * иначе — первую доступную для вывода. Возвращает имя сети (для параметра
 * `chain` при выводе), минимальную сумму и комиссию (или null, если не указаны).
 */
export async function fetchTrxWithdrawInfo(): Promise<{
  chain: string;
  minAmount: number | null;
  fee: number | null;
}> {
  const coins = await signedRequest<BitgetCoin[]>("GET", "/api/v2/spot/public/coins", {
    query: { coin: "TRX" },
  });
  const chains = coins.find((c) => c.coin === "TRX")?.chains ?? [];
  const chain =
    chains.find((c) => c.chain.toUpperCase() === "TRX") ??
    chains.find((c) => c.withdrawable === "true") ??
    chains[0];
  if (!chain) {
    throw new Error("Bitget: сеть TRON для TRX недоступна");
  }
  return {
    chain: chain.chain,
    minAmount: toNumberOrNull(chain.minWithdrawAmount),
    fee: toNumberOrNull(chain.withdrawFee),
  };
}

/**
 * On-chain вывод TRX со спотового счёта на внешний адрес:
 * POST /api/v2/spot/wallet/withdrawal. `size` — десятичная строка в TRX (не micro),
 * `chain` — имя сети из fetchTrxWithdrawInfo. Возвращает orderId созданной заявки.
 * Требует API-ключ с правом Withdraw (и, как правило, адрес в whitelist Bitget).
 */
export async function withdrawTrx(params: {
  address: string;
  amount: number;
  chain: string;
}): Promise<{ orderId: string }> {
  const data = await signedRequest<{ orderId: string; clientOid: string }>(
    "POST",
    "/api/v2/spot/wallet/withdrawal",
    {
      body: {
        coin: "TRX",
        transferType: "on_chain",
        address: params.address,
        chain: params.chain,
        size: String(params.amount),
        clientOid: randomUUID(),
      },
    },
  );
  return { orderId: data.orderId };
}
