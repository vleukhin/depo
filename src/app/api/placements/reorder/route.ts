import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api-helpers";
import { reorderInput } from "@/lib/validate";
import { reorderPlacements } from "@/lib/repo";

export const runtime = "nodejs";

export function POST(request: Request) {
  return handle(async () => {
    const { ids } = await parseBody(request, reorderInput);
    await reorderPlacements(ids);
    return NextResponse.json({ ok: true });
  });
}
