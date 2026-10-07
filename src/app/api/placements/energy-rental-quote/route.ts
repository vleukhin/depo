import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { energyRentParams } from "@/lib/validate";
import { fetchBalanceTrx, quoteBandwidth, quoteEnergy, rentalVolumes } from "@/lib/tronrental";
import type { EnergyRentalQuote } from "@/types";

export const runtime = "nodejs";

// Котировка аренды энергии (+ bandwidth) в TronRental для попапа пополнения
// газа: баланс аккаунта и итоговые цены по объёмам, посчитанным из числа
// переводов USDT. Адрес для котировки не нужен — цена от него не зависит.
export function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    const input = energyRentParams.parse({
      transfers: Number(params.get("transfers")),
      newRecipient: params.get("newRecipient") === "1",
      bandwidth: params.get("bandwidth") ?? "none",
    });

    const volumes = rentalVolumes(input);
    const bwDuration = input.bandwidth === "none" ? null : input.bandwidth;
    const [balance, energyTotal, bandwidthTotal] = await Promise.all([
      fetchBalanceTrx(),
      quoteEnergy(volumes.energy),
      volumes.bandwidth != null && bwDuration
        ? quoteBandwidth(volumes.bandwidth, bwDuration)
        : Promise.resolve(null),
    ]);

    const bandwidth =
      volumes.bandwidth != null && bwDuration && bandwidthTotal != null
        ? { volume: volumes.bandwidth, duration: bwDuration, total: bandwidthTotal }
        : null;

    return NextResponse.json({
      balance,
      energy: { volume: volumes.energy, total: energyTotal },
      bandwidth,
      total: energyTotal + (bandwidth?.total ?? 0),
    } satisfies EnergyRentalQuote);
  });
}
