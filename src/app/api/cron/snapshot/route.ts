// Ежедневный снимок газа и депо. Путь /api/cron/snapshot открыт от cookie-гейта (см. proxy.ts);
// фактическая защита — заголовок Authorization: Bearer <CRON_SECRET>, который Vercel Cron
// шлёт сам (имя переменной зарезервировано платформой). Перед снимком обновляем балансы
// из сети/с бирж, чтобы конец дня отражал реальное состояние.

import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { verifyBearerToken } from "@/lib/auth";
import { checkAllBalances } from "@/lib/check-balances";
import { createDepoSnapshot } from "@/lib/repo";

export const runtime = "nodejs";
// Обход всех записей с паузами должен уложиться в лимит serverless-функции.
export const maxDuration = 60;

export function GET(request: Request) {
  return handle(async () => {
    if (!verifyBearerToken(request.headers.get("authorization"), process.env.CRON_SECRET)) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }
    const balances = await checkAllBalances();
    // Снимок депо делаем после сверки — по свежим суммам. Ошибки отдельных записей
    // (balances.failed) снимок не отменяют: фиксируем состояние как есть.
    const snapshot = await createDepoSnapshot({ comment: "Автоснимок" });
    return NextResponse.json({ ...balances, snapshot_id: snapshot.id });
  });
}
