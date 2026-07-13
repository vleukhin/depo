import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { fetchTrxUsdtPrice } from "@/lib/bitget";
import type { TrxPrice } from "@/types";

export const runtime = "nodejs";

/** Текущий курс TRX/USDT (≈ USD) с Bitget. При ошибке биржи — { price: null }. */
export function GET() {
  return handle(async () => {
    let price: number | null = null;
    try {
      price = await fetchTrxUsdtPrice();
    } catch {
      // Курс — вспомогательная информация: без него дашборд работает дальше.
    }
    return NextResponse.json({ price } satisfies TrxPrice);
  });
}
