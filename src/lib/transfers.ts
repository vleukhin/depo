// Единая точка входа для истории переводов USDT: TRON читается через TronGrid,
// EVM-сети — через NodeReal MegaNode. Контракт страницы общий
// (UsdtTransfersPage), курсор непрозрачный: у TRON это fingerprint,
// у EVM — pageKey NodeReal.

import { isEvmChain } from "@/lib/chains";
import * as nodereal from "@/lib/nodereal";
import * as tron from "@/lib/tron";
import type { Chain, UsdtTransfer, UsdtTransfersPage } from "@/types";

/** Страница переводов USDT по адресу кошелька, свежие сверху. */
export function fetchUsdtTransfers(
  chain: Chain,
  address: string,
  query: { limit?: number; cursor?: string } = {},
): Promise<UsdtTransfersPage> {
  return isEvmChain(chain)
    ? nodereal.fetchUsdtTransfers(chain, address, { limit: query.limit, page: query.cursor })
    : tron.fetchUsdtTransfers(address, { limit: query.limit, fingerprint: query.cursor });
}

/** Все переводы USDT адреса за окно [from, to] (мс от эпохи, границы включительно). */
export function fetchUsdtTransfersInRange(
  chain: Chain,
  address: string,
  from: number,
  to: number,
): Promise<{ transfers: UsdtTransfer[]; truncated: boolean }> {
  return isEvmChain(chain)
    ? nodereal.fetchUsdtTransfersInRange(chain, address, from, to)
    : tron.fetchUsdtTransfersInRange(address, from, to);
}

/**
 * Пауза между запросами истории по разным кошелькам: у TronGrid без ключа
 * жёсткий лимит, у NodeReal на бесплатном тарифе — ограничение по CUPS.
 */
export function historyRequestPause(chain: Chain): number {
  if (isEvmChain(chain)) return 250;
  return process.env.TRONGRID_API_KEY ? 100 : 600;
}
