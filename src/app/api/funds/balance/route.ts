import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { verifyBearerToken } from "@/lib/auth";
import { getFundAmountByName } from "@/lib/repo";

export const runtime = "nodejs";

/**
 * Внешний read-only эндпоинт: баланс средства по названию.
 * Открыт от cookie-гейта (см. PUBLIC_PATHS в src/proxy.ts), авторизация —
 * заголовок Authorization: Bearer <EXTERNAL_API_TOKEN>.
 * Если средства с таким названием нет — 200 с amount: 0.
 */
export function GET(request: Request) {
  return handle(async () => {
    if (!verifyBearerToken(request.headers.get("authorization"), process.env.EXTERNAL_API_TOKEN)) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }
    const name = new URL(request.url).searchParams.get("name")?.trim() ?? "";
    if (!name) {
      return NextResponse.json({ error: "Укажите название" }, { status: 400 });
    }
    return NextResponse.json({ amount: await getFundAmountByName(name) });
  });
}
