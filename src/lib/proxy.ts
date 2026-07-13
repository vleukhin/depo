// HTTP(S)-прокси со статическим IP для исходящих запросов к биржам (Bitget/KuCoin).
//
// На Vercel у serverless-функций нет фиксированного исходящего IP, а право Withdraw
// на ключе Bitget требует IP в whitelist. Задав EXCHANGE_PROXY_URL (свой прокси со
// статическим IP), пускаем биржевые запросы через него; IP прокси вписывается в
// whitelist ключа биржи. Только биржи — TronGrid/Telegram/БД идут напрямую.
//
// HTTPS-прокси (EXCHANGE_PROXY_URL=https://...) шифрует и пароль прокси в транзите.
// Для самоподписанного сертификата (VPS без домена):
//   EXCHANGE_PROXY_CA          — PEM сертификата, пинится через proxyTls.ca (иначе Node
//                                не доверяет самоподписанному).
//   EXCHANGE_PROXY_SERVERNAME  — DNS-метка из SAN сертификата (напр. "depo-proxy").
//                                Обязательна для HTTPS-прокси по голому IP: undici не
//                                умеет ставить SNI на IP-адрес, поэтому TCP идёт на IP
//                                из URL, а TLS проверяется по этой метке (она же в SAN).
// requestTls не трогаем: TLS-туннель до самой биржи проверяется по публичным CA как обычно.
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
    if (url) {
      // Допускаем как многострочный PEM, так и однострочный со \n (Vercel/.env).
      const ca = process.env.EXCHANGE_PROXY_CA?.replace(/\\n/g, "\n");
      const servername = process.env.EXCHANGE_PROXY_SERVERNAME;
      const proxyTls = ca
        ? { ca, ...(servername ? { servername } : {}) }
        : undefined;
      g.__exchangeProxy = new ProxyAgent(
        proxyTls ? { uri: url, proxyTls } : url,
      );
    } else {
      g.__exchangeProxy = null;
    }
  }
  return g.__exchangeProxy ?? undefined;
}
