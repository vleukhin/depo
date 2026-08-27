import { NextResponse } from "next/server";
import { handle, notFound, parseId } from "@/lib/api-helpers";
import { findDebtsByTxIds, getPlacement } from "@/lib/repo";
import { isChainAddress } from "@/lib/chains";
import { fetchUsdtTransfers } from "@/lib/transfers";

export const runtime = "nodejs";

// Переводы USDT по адресу внешнего кошелька — для попапа истории. Источник
// зависит от сети записи (TronGrid либо Etherscan). Пагинация непрозрачным
// курсором: ?cursor=<next предыдущей страницы>.
export function GET(request: Request, ctx: RouteContext<"/api/placements/[id]/transactions">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    const placement = await getPlacement(id);
    if (
      !placement ||
      placement.kind !== "wallet" ||
      !isChainAddress(placement.chain, placement.address)
    ) {
      notFound();
    }
    const cursor = new URL(request.url).searchParams.get("cursor") ?? undefined;
    const page = await fetchUsdtTransfers(placement.chain, placement.address, {
      limit: 10,
      cursor,
    });
    // Метки «долг уже создан»: подтягиваем активные долги, привязанные к этим транзакциям.
    const debts = await findDebtsByTxIds(page.transfers.map((t) => t.tx_id));
    return NextResponse.json({
      transfers: page.transfers.map((t) => ({ ...t, debt: debts.get(t.tx_id) ?? null })),
      next: page.next,
    });
  });
}
