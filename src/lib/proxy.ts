// HTTP-прокси со статическим IP для исходящих запросов к биржам (Bitget/KuCoin).
//
// На Vercel у serverless-функций нет фиксированного исходящего IP, а право Withdraw
// на ключе Bitget требует IP в whitelist. Задав EXCHANGE_PROXY_URL (свой прокси со
// статическим IP), пускаем биржевые запросы через него; IP прокси вписывается в
// whitelist ключа биржи. Только биржи — TronGrid/Telegram/БД идут напрямую.
//
// Не задан -> undefined -> обычный прямой fetch (нормальный режим локальной разработки).

import { ProxyAgent } from "undici";

// Мемоизируем агент на globalThis (как соединение БД в lib/db.ts), чтобы dev-HMR
// не плодил экземпляры ProxyAgent. null = «проверено, переменная не задана» —
// отличаем от undefined = «ещё не инициализировано».
const g = globalThis as unknown as { __exchangeProxy?: ProxyAgent | null };

export function getExchangeDispatcher(): ProxyAgent | undefined {
  if (g.__exchangeProxy === undefined) {
    const url = process.env.EXCHANGE_PROXY_URL;
    g.__exchangeProxy = url ? new ProxyAgent(url) : null;
  }
  return g.__exchangeProxy ?? undefined;
}
