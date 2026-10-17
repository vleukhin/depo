import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { fetchSpotPrice } from "@/lib/bitget";
import { CHAIN_META } from "@/lib/chains";
import { CHAINS, type Chain, type NativePrices } from "@/types";

export const runtime = "nodejs";

/**
 * Текущие курсы нативных монет (TRX/BNB/ETH) к USDT (≈ USD) с Bitget.
 * Курс — вспомогательная информация: сеть, по которой запрос упал, отдаётся
 * как null, и дашборд продолжает работать. Ответ — по сетям, но запрос — по
 * монетам: газ Ethereum и Arbitrum — один и тот же ETH.
 */
export function GET() {
  return handle(async () => {
    const coins = [...new Set(CHAINS.map((chain) => CHAIN_META[chain].native))];
    const prices = new Map(
      await Promise.all(
        coins.map(async (coin) => {
          try {
            return [coin, await fetchSpotPrice(`${coin}USDT`)] as const;
          } catch {
            return [coin, null] as const;
          }
        }),
      ),
    );
    const byChain = Object.fromEntries(
      CHAINS.map((chain) => [chain, prices.get(CHAIN_META[chain].native) ?? null]),
    ) as Record<Chain, number | null>;
    return NextResponse.json(byChain satisfies NativePrices);
  });
}
