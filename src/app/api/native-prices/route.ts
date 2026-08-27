import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { fetchSpotPrice } from "@/lib/bitget";
import { CHAIN_META } from "@/lib/chains";
import { CHAINS, type Chain, type NativePrices } from "@/types";

export const runtime = "nodejs";

/**
 * Текущие курсы нативных монет (TRX/BNB/ETH) к USDT (≈ USD) с Bitget.
 * Курс — вспомогательная информация: сеть, по которой запрос упал, отдаётся
 * как null, и дашборд продолжает работать.
 */
export function GET() {
  return handle(async () => {
    const entries = await Promise.all(
      CHAINS.map(async (chain) => {
        try {
          return [chain, await fetchSpotPrice(`${CHAIN_META[chain].native}USDT`)] as const;
        } catch {
          return [chain, null] as const;
        }
      }),
    );
    return NextResponse.json(
      Object.fromEntries(entries) as Record<Chain, number | null> satisfies NativePrices,
    );
  });
}
