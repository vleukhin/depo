// Вебхук Telegram-бота. Путь /api/telegram открыт от cookie-гейта (см. proxy.ts);
// фактическая защита — секрет-заголовок Telegram + allow-list владельца.
//
// Всегда отвечаем HTTP 200 (даже на ошибках), иначе Telegram будет ретраить
// update и бот «зациклится». Поэтому handle()/parseBody() тут не используются.

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { markTgUpdateProcessed } from "@/lib/repo";
import { handleUpdate } from "@/lib/telegram/dispatch";
import type { TgUpdate } from "@/lib/telegram/types";

export const runtime = "nodejs";
// Синхронный LLM-парс должен уложиться в лимит serverless-функции.
export const maxDuration = 30;

const ok = () => NextResponse.json({ ok: true });

/** Сверка X-Telegram-Bot-Api-Secret-Token c TELEGRAM_WEBHOOK_SECRET (timing-safe). */
function secretMatches(header: string | null): boolean {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !header) return false;
  // Хэшируем обе стороны — timingSafeEqual требует буферы равной длины (как в auth.ts).
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

/** Update принадлежит владельцу (TELEGRAM_OWNER_CHAT_ID)? Чужие — тихо игнорируем. */
function isOwner(update: TgUpdate): boolean {
  const owner = Number(process.env.TELEGRAM_OWNER_CHAT_ID);
  if (!Number.isInteger(owner) || owner === 0) return false;
  const chatId = update.message?.chat.id ?? update.callback_query?.message?.chat.id;
  const fromId = update.message?.from?.id ?? update.callback_query?.from.id;
  return (chatId ?? fromId) === owner;
}

export async function POST(request: Request) {
  try {
    if (!secretMatches(request.headers.get("x-telegram-bot-api-secret-token"))) {
      return ok(); // не раскрываем, что путь существует
    }
    const update = (await request.json().catch(() => null)) as TgUpdate | null;
    if (!update || !Number.isInteger(update.update_id)) return ok();
    if (!isOwner(update)) return ok();
    // Дедуп: Telegram может доставить update повторно (ретраи, restart вебхука).
    if (!(await markTgUpdateProcessed(update.update_id))) return ok();

    await handleUpdate(update);
  } catch (err) {
    console.error("Telegram webhook:", err);
  }
  return ok();
}
