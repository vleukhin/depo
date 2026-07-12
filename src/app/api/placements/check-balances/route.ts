import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import {
  listExchangePlacements,
  listPlacementsWithAddress,
  updateAmountFromChain,
} from "@/lib/repo";
import { fetchUsdtBalance, isTronAddress } from "@/lib/tron";
import { fetchUsdtBalanceMicro as fetchKucoinBalance } from "@/lib/kucoin";
import { fetchUsdtBalanceMicro as fetchBitgetBalance } from "@/lib/bitget";
import type { CheckBalancesResult, Exchange, ExchangeAccount } from "@/types";

export const runtime = "nodejs";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const EXCHANGE_FETCHERS: Record<Exchange, (account: ExchangeAccount) => Promise<number>> = {
  KuCoin: fetchKucoinBalance,
  Bitget: fetchBitgetBalance,
};

export function POST() {
  return handle(async () => {
    const result: CheckBalancesResult = { checked: 0, failed: [], skipped: 0 };

    // Кошельки: баланс USDT (TRC-20) по адресу через TronGrid.
    for (const { id, name, address } of await listPlacementsWithAddress()) {
      if (!isTronAddress(address)) {
        result.skipped++;
        continue;
      }
      try {
        const micro = await fetchUsdtBalance(address);
        await updateAmountFromChain(id, micro);
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

    // Биржи: баланс USDT на счёте через приватный API (KuCoin/Bitget).
    for (const { id, name, exchange, exchange_account } of await listExchangePlacements()) {
      try {
        const micro = await EXCHANGE_FETCHERS[exchange](exchange_account);
        await updateAmountFromChain(id, micro);
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

    return NextResponse.json(result);
  });
}
