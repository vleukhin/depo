import { NextResponse } from "next/server";
import { handle, notFound, parseBody } from "@/lib/api-helpers";
import { gasWithdrawInput } from "@/lib/validate";
import { getPlacement } from "@/lib/repo";
import { fetchCoinWithdrawInfo, withdrawCoin } from "@/lib/bitget";
import { CHAIN_META, isChainAddress } from "@/lib/chains";
import type { WithdrawGasResult } from "@/types";

export const runtime = "nodejs";

// On-chain вывод нативной монеты («газа») с биржи на адрес кошелька. Адрес
// получателя и сеть берём из сохранённой записи (клиент шлёт только
// placementId), проверяем тип записи и формат адреса. Источник — спотовый
// счёт. Пока поддержана только Bitget.
export function POST(request: Request) {
  return handle(async () => {
    const { placementId, exchange, amount } = await parseBody(request, gasWithdrawInput);

    const placement = await getPlacement(placementId);
    if (!placement) notFound();
    if (placement.kind !== "wallet" || !isChainAddress(placement.chain, placement.address)) {
      throw NextResponse.json(
        { error: `У записи нет валидного адреса для сети ${CHAIN_META[placement.chain].label}` },
        { status: 400 },
      );
    }
    if (exchange !== "Bitget") {
      throw NextResponse.json({ error: "Пока поддерживается только Bitget" }, { status: 400 });
    }

    const { native, bitgetChain } = CHAIN_META[placement.chain];
    const { chain } = await fetchCoinWithdrawInfo(native, bitgetChain);
    const result = await withdrawCoin({
      coin: native,
      address: placement.address,
      amount,
      chain,
    });
    return NextResponse.json(result satisfies WithdrawGasResult);
  });
}
