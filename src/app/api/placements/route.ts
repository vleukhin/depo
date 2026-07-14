import { type NextRequest, NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api-helpers";
import { placementInput } from "@/lib/validate";
import { createPlacement, listDeletedPlacements, listPlacements } from "@/lib/repo";

export const runtime = "nodejs";

// ?deleted=1 — только удалённые записи (страница архива).
export function GET(request: NextRequest) {
  return handle(async () => {
    const deleted = request.nextUrl.searchParams.get("deleted") === "1";
    return NextResponse.json(deleted ? await listDeletedPlacements() : await listPlacements());
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, placementInput);
    return NextResponse.json(await createPlacement(input), { status: 201 });
  });
}
