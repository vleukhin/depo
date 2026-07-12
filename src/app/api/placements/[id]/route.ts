import { NextResponse } from "next/server";
import { handle, notFound, parseBody, parseId } from "@/lib/api-helpers";
import { placementInput } from "@/lib/validate";
import { deletePlacement, updatePlacement } from "@/lib/repo";

export const runtime = "nodejs";

export function PUT(request: Request, ctx: RouteContext<"/api/placements/[id]">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    const input = await parseBody(request, placementInput);
    const updated = updatePlacement(id, input);
    if (!updated) notFound();
    return NextResponse.json(updated);
  });
}

export function DELETE(_request: Request, ctx: RouteContext<"/api/placements/[id]">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    if (!deletePlacement(id)) notFound();
    return NextResponse.json({ ok: true });
  });
}
