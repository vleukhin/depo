import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { listNativeSnapshots } from "@/lib/repo";
import { CHAINS, type Chain } from "@/types";

export const runtime = "nodejs";

/**
 * История ежедневных снимков суммарного газа одной сети за последние ?days=N
 * дней (1–365, по умолчанию 30). ?chain — сеть (по умолчанию tron).
 */
export function GET(request: Request) {
  return handle(async () => {
    const params = new URL(request.url).searchParams;
    const raw = Number(params.get("days") ?? 30);
    const days = Number.isInteger(raw) && raw >= 1 && raw <= 365 ? raw : 30;
    const requested = params.get("chain");
    const chain: Chain = CHAINS.includes(requested as Chain) ? (requested as Chain) : "tron";
    return NextResponse.json(await listNativeSnapshots(chain, days));
  });
}
