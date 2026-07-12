import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api-helpers";
import { debtInput } from "@/lib/validate";
import { createDebt, listDebts } from "@/lib/repo";

export const runtime = "nodejs";

export function GET() {
  return handle(() => NextResponse.json(listDebts()));
}

export function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, debtInput);
    return NextResponse.json(createDebt(input), { status: 201 });
  });
}
