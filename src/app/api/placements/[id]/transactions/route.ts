import { NextResponse } from "next/server";
import { handle, notFound, parseId } from "@/lib/api-helpers";
import { getPlacement } from "@/lib/repo";
import { fetchUsdtTransfers, isTronAddress } from "@/lib/tron";

export const runtime = "nodejs";

// Последние переводы USDT (TRC-20) по адресу внешнего кошелька — для попапа истории.
export function GET(_request: Request, ctx: RouteContext<"/api/placements/[id]/transactions">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    const placement = await getPlacement(id);
    if (!placement || placement.kind !== "wallet" || !isTronAddress(placement.address)) {
      notFound();
    }
    const transfers = await fetchUsdtTransfers(placement.address, 10);
    return NextResponse.json(transfers);
  });
}
