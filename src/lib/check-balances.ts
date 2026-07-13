import {
  listExchangePlacements,
  listPlacementsWithAddress,
  updateBalancesFromChain,
  upsertTodayTrxSnapshot,
} from "@/lib/repo";
import { fetchTrxBalance, fetchUsdtBalance, isTronAddress } from "@/lib/tron";
import {
  fetchTrxBalanceMicro as fetchKucoinTrx,
  fetchUsdtBalanceMicro as fetchKucoinUsdt,
} from "@/lib/kucoin";
import {
  fetchTrxBalanceMicro as fetchBitgetTrx,
  fetchUsdtBalanceMicro as fetchBitgetUsdt,
} from "@/lib/bitget";
import type { CheckBalancesResult, Exchange, ExchangeAccount } from "@/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ExchangeFetcher = (account: ExchangeAccount) => Promise<number>;
const USDT_FETCHERS: Record<Exchange, ExchangeFetcher> = {
  KuCoin: fetchKucoinUsdt,
  Bitget: fetchBitgetUsdt,
};
const TRX_FETCHERS: Record<Exchange, ExchangeFetcher> = {
  KuCoin: fetchKucoinTrx,
  Bitget: fetchBitgetTrx,
};

/**
 * Обновляет балансы всех размещений из сети/с бирж и апсертит снимок
 * суммарного TRX за сегодня. Общая логика ручной проверки (кнопка в UI)
 * и ежедневного крона (/api/cron/snapshot).
 */
export async function checkAllBalances(): Promise<CheckBalancesResult> {
  const result: CheckBalancesResult = { checked: 0, failed: [], skipped: 0 };

  // Кошельки: балансы USDT (TRC-20) и нативного TRX по адресу через TronGrid.
  for (const { id, name, address } of await listPlacementsWithAddress()) {
    if (!isTronAddress(address)) {
      result.skipped++;
      continue;
    }
    try {
      const usdt = await fetchUsdtBalance(address);
      const trx = await fetchTrxBalance(address);
      await updateBalancesFromChain(id, usdt, trx);
      result.checked++;
    } catch (err) {
      result.failed.push({
        id,
        name,
        error: err instanceof Error ? err.message : "Ошибка запроса",
      });
    }
    // с API-ключом лимиты TronGrid заметно выше — пауза меньше
    await sleep(process.env.TRONGRID_API_KEY ? 100 : 600);
  }

  // Биржи: балансы USDT и TRX на счёте через приватный API (KuCoin/Bitget).
  for (const { id, name, exchange, exchange_account } of await listExchangePlacements()) {
    try {
      const usdt = await USDT_FETCHERS[exchange](exchange_account);
      const trx = await TRX_FETCHERS[exchange](exchange_account);
      await updateBalancesFromChain(id, usdt, trx);
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

  await upsertTodayTrxSnapshot();

  return result;
}
