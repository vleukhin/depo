import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { checkAllBalances } from "@/lib/check-balances";

export const runtime = "nodejs";

export function POST() {
  return handle(async () => NextResponse.json(await checkAllBalances()));
}
