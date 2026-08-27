// Единая точка входа для истории переводов USDT: TRON читается через TronGrid,
// EVM-сети — через Etherscan v2. Контракт страницы общий (UsdtTransfersPage),
// курсор непрозрачный: у TRON это fingerprint, у EVM — номер страницы.

import { isEvmChain } from "@/lib/chains";
import * as etherscan from "@/lib/etherscan";
import * as tron from "@/lib/tron";
import type { Chain, UsdtTransfer, UsdtTransfersPage } from "@/types";

/** Страница переводов USDT по адресу кошелька, свежие сверху. */
export function fetchUsdtTransfers(
  chain: Chain,
  address: string,
  query: { limit?: number; cursor?: string } = {},
): Promise<UsdtTransfersPage> {
  return isEvmChain(chain)
    ? etherscan.fetchUsdtTransfers(chain, address, { limit: query.limit, page: query.cursor })
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
    ? etherscan.fetchUsdtTransfersInRange(chain, address, from, to)
    : tron.fetchUsdtTransfersInRange(address, from, to);
}

/**
 * Пауза между запросами истории по разным кошелькам: у TronGrid без ключа
 * жёсткий лимит, у Etherscan на бесплатном тарифе — 5 запросов в секунду.
 */
export function historyRequestPause(chain: Chain): number {
  if (isEvmChain(chain)) return 250;
  return process.env.TRONGRID_API_KEY ? 100 : 600;
}
