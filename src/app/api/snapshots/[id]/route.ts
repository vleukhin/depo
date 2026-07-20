import { NextResponse } from "next/server";
import { handle, notFound, parseId } from "@/lib/api-helpers";
import { deleteDepoSnapshot, getDepoSnapshot } from "@/lib/repo";

export const runtime = "nodejs";

export function GET(_request: Request, ctx: RouteContext<"/api/snapshots/[id]">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    const snapshot = await getDepoSnapshot(id);
    if (!snapshot) notFound();
    return NextResponse.json(snapshot);
  });
}

export function DELETE(_request: Request, ctx: RouteContext<"/api/snapshots/[id]">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    if (!(await deleteDepoSnapshot(id))) notFound();
    return NextResponse.json({ ok: true });
  });
}
