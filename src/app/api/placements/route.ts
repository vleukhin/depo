import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api-helpers";
import { placementInput } from "@/lib/validate";
import { createPlacement, listPlacements } from "@/lib/repo";

export const runtime = "nodejs";

export function GET() {
  return handle(() => NextResponse.json(listPlacements()));
}

export function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, placementInput);
    return NextResponse.json(createPlacement(input), { status: 201 });
  });
}
