import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api-helpers";
import { placementInput } from "@/lib/validate";
import { createPlacement, listPlacements } from "@/lib/repo";

export const runtime = "nodejs";

export function GET() {
  return handle(async () => NextResponse.json(await listPlacements()));
}

export function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, placementInput);
    return NextResponse.json(await createPlacement(input), { status: 201 });
  });
}
