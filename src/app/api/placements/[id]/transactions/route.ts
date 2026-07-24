import { NextResponse } from "next/server";
import { handle, notFound, parseId } from "@/lib/api-helpers";
import { findDebtsByTxIds, getPlacement } from "@/lib/repo";
import { fetchUsdtTransfers, isTronAddress } from "@/lib/tron";

export const runtime = "nodejs";

// Переводы USDT (TRC-20) по адресу внешнего кошелька — для попапа истории.
// Пагинация курсором TronGrid: ?fingerprint=<meta.fingerprint предыдущей страницы>.
export function GET(request: Request, ctx: RouteContext<"/api/placements/[id]/transactions">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    const placement = await getPlacement(id);
    if (!placement || placement.kind !== "wallet" || !isTronAddress(placement.address)) {
      notFound();
    }
    const fingerprint = new URL(request.url).searchParams.get("fingerprint") ?? undefined;
    const page = await fetchUsdtTransfers(placement.address, 10, fingerprint);
    // Метки «долг уже создан»: подтягиваем активные долги, привязанные к этим транзакциям.
    const debts = await findDebtsByTxIds(page.transfers.map((t) => t.tx_id));
    return NextResponse.json({
      transfers: page.transfers.map((t) => ({ ...t, debt: debts.get(t.tx_id) ?? null })),
      next: page.next,
    });
  });
}
