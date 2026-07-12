import { NextResponse } from "next/server";
import { handle, notFound, parseBody, parseId } from "@/lib/api-helpers";
import { debtInput } from "@/lib/validate";
import { deleteDebt, updateDebt } from "@/lib/repo";

export const runtime = "nodejs";

export function PUT(request: Request, ctx: RouteContext<"/api/debts/[id]">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    const input = await parseBody(request, debtInput);
    const updated = updateDebt(id, input);
    if (!updated) notFound();
    return NextResponse.json(updated);
  });
}

export function DELETE(_request: Request, ctx: RouteContext<"/api/debts/[id]">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    if (!deleteDebt(id)) notFound();
    return NextResponse.json({ ok: true });
  });
}
