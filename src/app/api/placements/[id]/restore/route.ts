import { NextResponse } from "next/server";
import { handle, notFound, parseId } from "@/lib/api-helpers";
import { restorePlacement } from "@/lib/repo";

export const runtime = "nodejs";

export function POST(_request: Request, ctx: RouteContext<"/api/placements/[id]/restore">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    const restored = await restorePlacement(id);
    if (!restored) notFound();
    return NextResponse.json(restored);
  });
}
