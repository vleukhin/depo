import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { listPlacementsWithAddress, updateAmountFromChain } from "@/lib/repo";
import { fetchUsdtBalance, isTronAddress } from "@/lib/tron";
import type { CheckBalancesResult } from "@/types";

export const runtime = "nodejs";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function POST() {
  return handle(async () => {
    const candidates = listPlacementsWithAddress();
    const result: CheckBalancesResult = { checked: 0, failed: [], skipped: 0 };

    for (const { id, name, address } of candidates) {
      if (!isTronAddress(address)) {
        result.skipped++;
        continue;
      }
      try {
        const micro = await fetchUsdtBalance(address);
        updateAmountFromChain(id, micro);
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

    return NextResponse.json(result);
  });
}
