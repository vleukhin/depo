import { type NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { getDebtsSummary } from "@/lib/repo";

export const runtime = "nodejs";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/debts/summary?from=YYYY-MM-DD&to=YYYY-MM-DD — сводка активных долгов за период.
export function GET(request: NextRequest) {
  return handle(async () => {
    const from = request.nextUrl.searchParams.get("from") ?? "";
    const to = request.nextUrl.searchParams.get("to") ?? "";
    if (!YMD.test(from) || !YMD.test(to) || from > to) {
      throw NextResponse.json({ error: "Некорректный период" }, { status: 400 });
    }
    return NextResponse.json(await getDebtsSummary(from, to));
  });
}
