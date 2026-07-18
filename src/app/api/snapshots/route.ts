import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api-helpers";
import { snapshotInput } from "@/lib/validate";
import { createDepoSnapshot, listDepoSnapshots } from "@/lib/repo";

export const runtime = "nodejs";

export function GET() {
  return handle(async () => NextResponse.json(await listDepoSnapshots()));
}

export function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, snapshotInput);
    return NextResponse.json(await createDepoSnapshot(input), { status: 201 });
  });
}
