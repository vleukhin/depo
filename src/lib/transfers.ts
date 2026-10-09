// Единая точка входа для истории переводов USDT: TRON читается через TronGrid,
// EVM-сети — через NodeReal MegaNode. Контракт страницы общий
// (UsdtTransfersPage), курсор непрозрачный: у TRON это fingerprint,
// у EVM — pageKey NodeReal.

import { isEvmChain } from "@/lib/chains";
import * as nodereal from "@/lib/nodereal";
import * as tron from "@/lib/tron";
import type { Chain, UsdtTransfer, UsdtTransfersPage } from "@/types";

/**
 * Порог «пыли»: переводы меньше цента — это address poisoning (нулевые
 * transferFrom и дробные копейки с адресов-двойников), а не реальные движения.
 * В UI они округляются до «0» и только засоряют список, поэтому отбрасываются
 * здесь — в единой точке входа, для всех сетей и обоих видов запросов.
 */
const DUST_THRESHOLD = 0.01;

const notDust = (t: UsdtTransfer) => t.amount >= DUST_THRESHOLD;

/** Страница переводов USDT по адресу кошелька, свежие сверху. */
export async function fetchUsdtTransfers(
  chain: Chain,
  address: string,
  query: { limit?: number; cursor?: string } = {},
): Promise<UsdtTransfersPage> {
  // Курсор не трогаем: фильтр может укоротить страницу, но не сбивает пагинацию.
  const page = await (isEvmChain(chain)
    ? nodereal.fetchUsdtTransfers(chain, address, { limit: query.limit, page: query.cursor })
    : tron.fetchUsdtTransfers(address, { limit: query.limit, fingerprint: query.cursor }));
  return { ...page, transfers: page.transfers.filter(notDust) };
}

/** Все переводы USDT адреса за окно [from, to] (мс от эпохи, границы включительно). */
export async function fetchUsdtTransfersInRange(
  chain: Chain,
  address: string,
  from: number,
  to: number,
): Promise<{ transfers: UsdtTransfer[]; truncated: boolean }> {
  const res = await (isEvmChain(chain)
    ? nodereal.fetchUsdtTransfersInRange(chain, address, from, to)
    : tron.fetchUsdtTransfersInRange(address, from, to));
  return { ...res, transfers: res.transfers.filter(notDust) };
}

/**
 * Пауза между запросами истории по разным кошелькам: у TronGrid без ключа
 * жёсткий лимит, у NodeReal на бесплатном тарифе — ограничение по CUPS.
 */
export function historyRequestPause(chain: Chain): number {
  if (isEvmChain(chain)) return 250;
  return process.env.TRONGRID_API_KEY ? 100 : 600;
}
