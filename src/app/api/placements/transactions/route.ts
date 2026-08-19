import { NextResponse } from "next/server";
import { handle } from "@/lib/api-helpers";
import { collectDayTransfers } from "@/lib/day-transfers";

export const runtime = "nodejs";
// Обход всех кошельков идёт последовательно с паузами — запас как у крона.
export const maxDuration = 60;

// Переводы USDT (TRC-20) по всем внешним кошелькам за календарный день по МСК —
// для попапа «Транзакции» в блоке свободных средств. ?date=YYYY-MM-DD
export function GET(request: Request) {
  return handle(async () => {
    const date = new URL(request.url).searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw NextResponse.json({ error: "Некорректная дата" }, { status: 400 });
    }
    return NextResponse.json(await collectDayTransfers(date));
  });
}
