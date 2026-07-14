import { type NextRequest, NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api-helpers";
import { debtInput } from "@/lib/validate";
import { createDebt, listDeletedDebts, listDebts } from "@/lib/repo";

export const runtime = "nodejs";

// ?deleted=1 — только удалённые записи (страница архива).
export function GET(request: NextRequest) {
  return handle(async () => {
    const deleted = request.nextUrl.searchParams.get("deleted") === "1";
    return NextResponse.json(deleted ? await listDeletedDebts() : await listDebts());
  });
}

export function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, debtInput);
    return NextResponse.json(await createDebt(input), { status: 201 });
  });
}
