// Взаимодействие с REST API биржи Bybit (API v5).
//
// Приватные запросы подписываются (ключи HMAC, «System-generated API Keys»):
//   X-BAPI-SIGN = hex(HMAC-SHA256(secret, timestamp + apiKey + recvWindow + queryString))
// Для POST вместо queryString подписывается JSON-тело; здесь нужны только GET.
// Подписанная query-строка обязана совпадать с фактической строкой запроса.
//
// Модуль намеренно ничего не знает о сущностях приложения (funds/placements/БД) —
// это чистый клиент биржи. Достаточно ключа с правом Read-only.
//
// Хост по умолчанию — api.bybit.com; ключи аккаунтов региональных сущностей Bybit
// работают только на своём хосте (напр. api.bybit.eu для EEA) — его задаёт BYBIT_API_URL.

import { createHmac } from "node:crypto";

import type { Dispatcher } from "undici";

import { decimalToMicro } from "@/lib/money";
import { getExchangeDispatcher } from "@/lib/proxy";

// `||`, а не `??`: пустая переменная в env тоже значит «по умолчанию»; хвостовой
// слэш срезаем, чтобы путь не превратился в «//v5».
const BASE_URL = (process.env.BYBIT_API_URL || "https://api.bybit.com").replace(/\/+$/, "");
const RECV_WINDOW = "10000"; // мс; запас на прокси и расхождение часов
const RATE_LIMIT_CODE = 10006; // «Too many visits» — лимит приходит в теле, а не HTTP-статусом

const hmacHex = (secret: string, payload: string): string =>
  createHmac("sha256", secret).update(payload).digest("hex");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function credentials(): { key: string; secret: string } {
  const key = process.env.BYBIT_API_KEY;
  const secret = process.env.BYBIT_API_SECRET;
  if (!key || !secret) {
    throw new Error("Не заданы переменные BYBIT_API_KEY / BYBIT_API_SECRET");
  }
  return { key, secret };
}

type QueryParams = Record<string, string | number | undefined>;

/** Собирает query-строку (без «?»), отбрасывая пустые значения. */
function buildQuery(params: QueryParams = {}): string {
  const pairs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => [k, String(v)] as [string, string]);
  return new URLSearchParams(pairs).toString();
}

interface BybitEnvelope<T> {
  retCode: number;
  retMsg?: string;
  result?: T;
}

/**
 * Подписанный приватный GET-запрос к Bybit; возвращает поле `result` из ответа.
 * Прикладной статус проверяется по `retCode` (0 — успех), а не только по HTTP.
 * На HTTP 429 и retCode 10006 (rate limit) — до 3 повторов с растущей паузой;
 * подпись пересчитывается на каждой попытке (timestamp обязан совпадать с заголовком).
 */
export async function signedGet<T>(path: string, query: QueryParams = {}): Promise<T> {
  const { key, secret } = credentials();
  const qs = buildQuery(query);
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ""}`;

  let res: Response;
  let json: BybitEnvelope<T> | null;
  let attempt = 0;
  for (;;) {
    const timestamp = String(Date.now());
    res = await fetch(url, {
      method: "GET",
      headers: {
        "X-BAPI-API-KEY": key,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-RECV-WINDOW": RECV_WINDOW,
        "X-BAPI-SIGN": hmacHex(secret, timestamp + key + RECV_WINDOW + qs),
      },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
      // dispatcher — опция undici (глобальный fetch на нём и построен); в типе
      // RequestInit её нет, поэтому приведение. undefined -> прямой fetch.
      dispatcher: getExchangeDispatcher(),
    } as RequestInit & { dispatcher?: Dispatcher });
    json = (await res.json().catch(() => null)) as BybitEnvelope<T> | null;
    const rateLimited = res.status === 429 || json?.retCode === RATE_LIMIT_CODE;
    if (!rateLimited || attempt >= 3) break;
    attempt++;
    await sleep(1000 * attempt); // 1с, 2с, 3с
  }

  if (!res.ok || !json || json.retCode !== 0) {
    throw new Error(`Bybit: ${json?.retMsg || `HTTP ${res.status}`}`);
  }
  if (json.result === undefined) {
    throw new Error("Bybit: пустой ответ");
  }
  return json.result;
}

// ================= БАЛАНСЫ =================

export interface BybitWalletCoin {
  coin: string;
  walletBalance: string; // суммы Bybit отдаёт строками; поле может быть пустой строкой
  locked: string; // заблокировано под открытые спотовые ордера
  spotBorrow?: string; // заёмные средства (спот-маржа) — входят в walletBalance
}

interface BybitWalletBalance {
  list: { accountType: string; coin: BybitWalletCoin[] }[];
}

/** Монеты Unified Trading Account: GET /v5/account/wallet-balance?accountType=UNIFIED. */
export async function fetchUnifiedCoins(coin: string): Promise<BybitWalletCoin[]> {
  const result = await signedGet<BybitWalletBalance>("/v5/account/wallet-balance", {
    accountType: "UNIFIED",
    coin,
  });
  return (result.list ?? []).flatMap((a) => a.coin ?? []);
}

export interface BybitFundCoin {
  coin: string;
  walletBalance: string;
  transferBalance: string;
}

/**
 * Монеты Funding-счёта: GET /v5/asset/transfer/query-account-coins-balance?accountType=FUND.
 * `coin` обязателен: запрос всех монет FUND Bybit больше не поддерживает.
 */
export async function fetchFundCoins(coin: string): Promise<BybitFundCoin[]> {
  const result = await signedGet<{ balance?: BybitFundCoin[] }>(
    "/v5/asset/transfer/query-account-coins-balance",
    { accountType: "FUND", coin },
  );
  return result.balance ?? [];
}

/** Ошибка про отрицательный баланс монеты — маржа/заём на счёте, сверять нечего. */
const negativeBalance = (coin: string) =>
  new Error(`Bybit: отрицательный баланс ${coin} на едином счёте (маржа или заём)`);

/**
 * Десятичная строка суммы -> micro; пустую строку или отсутствующее поле считаем нулём.
 * decimalToMicro знак не принимает, поэтому минус (бывает у walletBalance в UTA)
 * разбираем отдельно — в ошибку про отрицательный баланс, а не «Некорректная сумма».
 */
function fieldToMicro(value: string | undefined, coin: string): number {
  if (value === undefined || value.trim() === "") return 0;
  if (value.trim().startsWith("-")) {
    if (/^-0*(\.0*)?$/.test(value.trim())) return 0; // «-0», «-0.00»
    throw negativeBalance(coin);
  }
  return decimalToMicro(value);
}

/**
 * Баланс произвольной монеты на счёте указанного типа в целых micro-единицах
 * (монета × 1 000 000). `spot` — Unified Trading Account: `walletBalance − spotBorrow − locked`
 * (свои средства без заёмных и без заблокированного в спотовых ордерах — как
 * `available` у KuCoin/Bitget).
 * `main` — Funding-счёт: `walletBalance`. `transferBalance` не берём: по
 * документации Bybit у свежих депозитов он бывает занижен, и сверка показала бы
 * недостачу. Если монеты на счёте нет — 0.
 *
 * Отрицательный баланс (UTA уходит в минус при марже/автозайме, или заёмное стоит
 * в ордере) не пишем в сумму записи, а бросаем понятную ошибку: строка попадёт в
 * `failed` проверки, прежняя сумма в БД останется.
 */
export async function fetchCoinBalanceMicro(
  coin: string,
  account: "spot" | "main",
): Promise<number> {
  if (account === "spot") {
    const coins = await fetchUnifiedCoins(coin);
    const total = coins
      .filter((c) => c.coin === coin)
      .reduce(
        (sum, c) =>
          sum +
          fieldToMicro(c.walletBalance, coin) -
          fieldToMicro(c.spotBorrow, coin) -
          fieldToMicro(c.locked, coin),
        0,
      );
    if (total < 0) throw negativeBalance(coin);
    return total;
  }
  const coins = await fetchFundCoins(coin);
  return coins
    .filter((c) => c.coin === coin)
    .reduce((sum, c) => sum + fieldToMicro(c.walletBalance, coin), 0);
}
