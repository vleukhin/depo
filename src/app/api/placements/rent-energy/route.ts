import { NextResponse } from "next/server";
import { handle, notFound, parseBody } from "@/lib/api-helpers";
import { energyRentInput } from "@/lib/validate";
import { getPlacement } from "@/lib/repo";
import { buyBandwidth, buyEnergy, rentalVolumes } from "@/lib/tronrental";
import { isChainAddress } from "@/lib/chains";
import type { EnergyRentResult } from "@/types";

export const runtime = "nodejs";

// Аренда энергии (+ опционально bandwidth) в TronRental на адрес TRON-кошелька.
// Адрес берём из сохранённой записи (клиент шлёт только placementId), объёмы
// считаем из числа переводов. Оплата — с баланса аккаунта TronRental.
export function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, energyRentInput);

    const placement = await getPlacement(input.placementId);
    if (!placement) notFound();
    if (placement.chain !== "tron") {
      throw NextResponse.json(
        { error: "Аренда энергии доступна только в сети TRON" },
        { status: 400 },
      );
    }
    if (placement.kind !== "wallet" || !isChainAddress("tron", placement.address)) {
      throw NextResponse.json(
        { error: "У записи нет валидного адреса для сети TRON" },
        { status: 400 },
      );
    }
    const address = placement.address.trim();
    const volumes = rentalVolumes(input);

    const energy = await buyEnergy(address, volumes.energy);

    // Энергия уже оплачена — ошибку bandwidth отдаём частичным успехом, а не 500:
    // иначе клиент решил бы, что не куплено ничего, и купил бы энергию повторно.
    let bandwidth: { id: number; price: number } | null = null;
    let bandwidthError: string | null = null;
    if (volumes.bandwidth != null && input.bandwidth !== "none") {
      try {
        bandwidth = await buyBandwidth(address, volumes.bandwidth, input.bandwidth);
      } catch (e) {
        console.error(e);
        bandwidthError = e instanceof Error ? e.message : "Не удалось арендовать bandwidth";
      }
    }

    return NextResponse.json({
      energyOrderId: energy.id,
      energyPrice: energy.price,
      bandwidthOrderId: bandwidth?.id ?? null,
      bandwidthPrice: bandwidth?.price ?? null,
      bandwidthError,
    } satisfies EnergyRentResult);
  });
}
