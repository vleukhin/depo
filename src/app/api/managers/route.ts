import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api-helpers";
import { managerInput } from "@/lib/validate";
import { createManager, listManagers } from "@/lib/repo";

export const runtime = "nodejs";

export function GET() {
  return handle(async () => NextResponse.json(await listManagers()));
}

export function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, managerInput);
    return NextResponse.json(await createManager(input), { status: 201 });
  });
}
