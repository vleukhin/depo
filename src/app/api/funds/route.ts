import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api-helpers";
import { fundInput } from "@/lib/validate";
import { createFund, listFunds } from "@/lib/repo";

export const runtime = "nodejs";

export function GET() {
  return handle(() => NextResponse.json(listFunds()));
}

export function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, fundInput);
    return NextResponse.json(createFund(input), { status: 201 });
  });
}
