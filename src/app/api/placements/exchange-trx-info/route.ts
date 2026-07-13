import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { fetchTrxBalanceMicro, fetchTrxWithdrawInfo } from "@/lib/bitget";
import { fromMicro } from "@/lib/money";
import type { ExchangeTrxInfo } from "@/types";

export const runtime = "nodejs";

// Баланс TRX и параметры вывода для попапа пополнения кошелька. Пока — только
// спотовый счёт Bitget; комиссия/минимум опциональны (если публичный запрос упал,
// баланс всё равно отдаём).
export function GET(request: Request) {
  return handle(async () => {
    const exchange = new URL(request.url).searchParams.get("exchange");
    if (exchange !== "Bitget") {
      throw NextResponse.json({ error: "Пока поддерживается только Bitget" }, { status: 400 });
    }

    const balance = fromMicro(await fetchTrxBalanceMicro("spot"));
    let fee: number | null = null;
    let min: number | null = null;
    try {
      const info = await fetchTrxWithdrawInfo();
      fee = info.fee;
      min = info.minAmount;
    } catch {
      // параметры вывода недоступны — не критично, баланс уже получен
    }

    return NextResponse.json({ balance, fee, min } satisfies ExchangeTrxInfo);
  });
}
