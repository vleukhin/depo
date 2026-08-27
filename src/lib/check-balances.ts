import { CHAIN_META, isChainAddress, isEvmChain } from "@/lib/chains";
import {
  listExchangePlacements,
  listPlacementsWithAddress,
  updateBalancesFromChain,
  upsertTodayNativeSnapshots,
} from "@/lib/repo";
import { fetchTrxBalance, fetchUsdtBalance as fetchTronUsdtBalance } from "@/lib/tron";
import { fetchNativeBalance, fetchUsdtBalance as fetchEvmUsdtBalance } from "@/lib/evm";
import { fetchCoinBalanceMicro as fetchKucoinCoin } from "@/lib/kucoin";
import { fetchCoinBalanceMicro as fetchBitgetCoin } from "@/lib/bitget";
import type { Chain, CheckBalancesResult, Exchange, ExchangeAccount } from "@/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ExchangeFetcher = (coin: string, account: ExchangeAccount) => Promise<number>;
const EXCHANGE_FETCHERS: Record<Exchange, ExchangeFetcher> = {
  KuCoin: fetchKucoinCoin,
  Bitget: fetchBitgetCoin,
};

/**
 * Балансы кошелька в его сети: USDT (идёт в amount) и нативная монета
 * («газ», идёт в native_amount), обе в micro-единицах.
 */
function fetchWalletBalances(
  chain: Chain,
  address: string,
): Promise<[usdt: number, native: number]> {
  return isEvmChain(chain)
    ? Promise.all([fetchEvmUsdtBalance(chain, address), fetchNativeBalance(chain, address)])
    : Promise.all([fetchTronUsdtBalance(address), fetchTrxBalance(address)]);
}

/**
 * Пауза между кошельками: у TronGrid без ключа жёсткий лимит, публичные
 * EVM-ноды такого не требуют.
 */
function walletPause(chain: Chain): number {
  if (isEvmChain(chain)) return 100;
  return process.env.TRONGRID_API_KEY ? 100 : 600;
}

/**
 * Обновляет балансы всех записей из сети/с бирж и апсертит снимки суммарного
 * газа за сегодня. Общая логика ручной проверки (кнопка в UI) и ежедневного
 * крона (/api/cron/snapshot).
 */
export async function checkAllBalances(): Promise<CheckBalancesResult> {
  const result: CheckBalancesResult = { checked: 0, failed: [], skipped: 0 };

  // Кошельки: USDT и нативная монета по адресу — TronGrid либо EVM-RPC.
  for (const { id, name, chain, address } of await listPlacementsWithAddress()) {
    if (!isChainAddress(chain, address)) {
      result.skipped++;
      continue;
    }
    try {
      const [usdt, native] = await fetchWalletBalances(chain, address);
      await updateBalancesFromChain(id, usdt, native);
      result.checked++;
    } catch (err) {
      result.failed.push({
        id,
        name,
        error: err instanceof Error ? err.message : "Ошибка запроса",
      });
    }
    await sleep(walletPause(chain));
  }

  // Биржи: USDT и нативная монета сети записи через приватный API (KuCoin/Bitget).
  for (const { id, name, chain, exchange, exchange_account } of await listExchangePlacements()) {
    try {
      const fetchCoin = EXCHANGE_FETCHERS[exchange];
      const usdt = await fetchCoin("USDT", exchange_account);
      const native = await fetchCoin(CHAIN_META[chain].native, exchange_account);
      await updateBalancesFromChain(id, usdt, native);
      result.checked++;
    } catch (err) {
      result.failed.push({
        id,
        name,
        error: err instanceof Error ? err.message : "Ошибка запроса",
      });
    }
    await sleep(250);
  }

  await upsertTodayNativeSnapshots();

  return result;
}
