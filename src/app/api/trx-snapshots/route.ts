import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { listTrxSnapshots } from "@/lib/repo";

export const runtime = "nodejs";

/** История ежедневных снимков суммарного TRX за последние ?days=N дней (1–365, по умолчанию 30). */
export function GET(request: Request) {
  return handle(async () => {
    const raw = Number(new URL(request.url).searchParams.get("days") ?? 30);
    const days = Number.isInteger(raw) && raw >= 1 && raw <= 365 ? raw : 30;
    return NextResponse.json(await listTrxSnapshots(days));
  });
}
