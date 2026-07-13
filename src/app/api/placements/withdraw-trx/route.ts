import { NextResponse } from "next/server";
import { handle, notFound, parseBody } from "@/lib/api-helpers";
import { trxWithdrawInput } from "@/lib/validate";
import { getPlacement } from "@/lib/repo";
import { fetchTrxWithdrawInfo, withdrawTrx } from "@/lib/bitget";
import { isTronAddress } from "@/lib/tron";
import type { WithdrawTrxResult } from "@/types";

export const runtime = "nodejs";

// On-chain вывод TRX с биржи на адрес кошелька. Адрес получателя берём из
// сохранённого размещения (клиент шлёт только placementId), проверяем его тип и
// валидность. Источник — спотовый счёт. Пока поддержана только Bitget.
export function POST(request: Request) {
  return handle(async () => {
    const { placementId, exchange, amount } = await parseBody(request, trxWithdrawInput);

    const placement = await getPlacement(placementId);
    if (!placement) notFound();
    if (placement.kind !== "wallet" || !placement.address || !isTronAddress(placement.address)) {
      throw NextResponse.json(
        { error: "У размещения нет валидного TRON-адреса" },
        { status: 400 },
      );
    }
    if (exchange !== "Bitget") {
      throw NextResponse.json({ error: "Пока поддерживается только Bitget" }, { status: 400 });
    }

    const { chain } = await fetchTrxWithdrawInfo();
    const result = await withdrawTrx({ address: placement.address, amount, chain });
    return NextResponse.json(result satisfies WithdrawTrxResult);
  });
}
