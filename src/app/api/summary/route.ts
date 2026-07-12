import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { getSummary } from "@/lib/repo";

export const runtime = "nodejs";

export function GET() {
  return handle(async () => NextResponse.json(await getSummary()));
}
