import { NextResponse } from "next/server";
import { handle, notFound, parseBody, parseId } from "@/lib/api-helpers";
import { fundInput } from "@/lib/validate";
import { deleteFund, updateFund } from "@/lib/repo";

export const runtime = "nodejs";

export function PUT(request: Request, ctx: RouteContext<"/api/funds/[id]">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    const input = await parseBody(request, fundInput);
    const updated = await updateFund(id, input);
    if (!updated) notFound();
    return NextResponse.json(updated);
  });
}

export function DELETE(_request: Request, ctx: RouteContext<"/api/funds/[id]">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    if (!(await deleteFund(id))) notFound();
    return NextResponse.json({ ok: true });
  });
}
