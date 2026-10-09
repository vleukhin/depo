import { type NextRequest, NextResponse } from "next/server";
import { handle, parseBody, parsePage } from "@/lib/api-helpers";
import { placementInput } from "@/lib/validate";
import { createPlacement, listDeletedPlacements, listPlacements } from "@/lib/repo";

export const runtime = "nodejs";

// ?deleted=1[&page=N] — только удалённые записи (страница архива, по 20 на страницу).
export function GET(request: NextRequest) {
  return handle(async () => {
    const params = request.nextUrl.searchParams;
    if (params.get("deleted") === "1") {
      return NextResponse.json(await listDeletedPlacements(parsePage(params.get("page"))));
    }
    return NextResponse.json(await listPlacements());
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, placementInput);
    return NextResponse.json(await createPlacement(input), { status: 201 });
  });
}
