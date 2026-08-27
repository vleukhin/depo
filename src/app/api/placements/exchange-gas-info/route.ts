import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { fetchCoinBalanceMicro, fetchCoinWithdrawInfo } from "@/lib/bitget";
import { CHAIN_META } from "@/lib/chains";
import { fromMicro } from "@/lib/money";
import { CHAINS, type Chain, type ExchangeGasInfo } from "@/types";

export const runtime = "nodejs";

// Баланс нативной монеты и параметры её вывода для попапа пополнения газа.
// Пока — только спотовый счёт Bitget; комиссия/минимум опциональны (если
// публичный запрос упал, баланс всё равно отдаём).
export function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    if (params.get("exchange") !== "Bitget") {
      throw NextResponse.json({ error: "Пока поддерживается только Bitget" }, { status: 400 });
    }
    const chain = params.get("chain") as Chain | null;
    if (!chain || !CHAINS.includes(chain)) {
      throw NextResponse.json({ error: "Некорректная сеть" }, { status: 400 });
    }

    const { native, bitgetChain } = CHAIN_META[chain];
    const balance = fromMicro(await fetchCoinBalanceMicro(native, "spot"));
    let fee: number | null = null;
    let min: number | null = null;
    try {
      const info = await fetchCoinWithdrawInfo(native, bitgetChain);
      fee = info.fee;
      min = info.minAmount;
    } catch {
      // параметры вывода недоступны — не критично, баланс уже получен
    }

    return NextResponse.json({ balance, fee, min } satisfies ExchangeGasInfo);
  });
}
