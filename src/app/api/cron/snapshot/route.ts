// Ежедневный снимок TRX. Путь /api/cron/snapshot открыт от cookie-гейта (см. proxy.ts);
// фактическая защита — заголовок Authorization: Bearer <CRON_SECRET>, который Vercel Cron
// шлёт сам (имя переменной зарезервировано платформой). Перед снимком обновляем балансы
// из сети/с бирж, чтобы конец дня отражал реальное состояние.

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { checkAllBalances } from "@/lib/check-balances";

export const runtime = "nodejs";
// Обход всех размещений с паузами должен уложиться в лимит serverless-функции.
export const maxDuration = 60;

/** Сверка Authorization с Bearer <CRON_SECRET> (timing-safe, как в telegram/route.ts). */
function cronSecretMatches(header: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !header) return false;
  // Хэшируем обе стороны — timingSafeEqual требует буферы равной длины (как в auth.ts).
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

export function GET(request: Request) {
  return handle(async () => {
    if (!cronSecretMatches(request.headers.get("authorization"))) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }
    return NextResponse.json(await checkAllBalances());
  });
}
