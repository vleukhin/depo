// Клиент Telegram Bot API. Конвенции как в tron.ts/kucoin.ts: нативный fetch,
// таймаут 10 с, cache no-store, до 3 повторов на 429, секреты из process.env.

import type { TgInlineKeyboard, TgMessage } from "@/lib/telegram/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function botToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Telegram: не задан TELEGRAM_BOT_TOKEN");
  }
  return token;
}

// Базовый URL переопределяем в тестах (как KUCOIN_API_URL/BITGET_API_URL).
const BASE_URL = process.env.TELEGRAM_API_URL ?? "https://api.telegram.org";

interface TgApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
}

async function call<T>(method: string, payload: Record<string, unknown>): Promise<T> {
  const url = `${BASE_URL}/bot${botToken()}/${method}`;
  const body = JSON.stringify(payload);

  let res: Response;
  let attempt = 0;
  for (;;) {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (res.status !== 429 || attempt >= 3) break;
    attempt++;
    await sleep(1000 * attempt); // 1с, 2с, 3с
  }

  const data = (await res.json().catch(() => null)) as TgApiResponse<T> | null;
  if (!res.ok || !data?.ok) {
    throw new Error(`Telegram: ${data?.description ?? `HTTP ${res.status}`}`);
  }
  return data.result as T;
}

/** Отправляет сообщение; возвращает message_id (нужен как prompt_message_id черновика). */
export async function sendMessage(
  chatId: number,
  text: string,
  keyboard?: TgInlineKeyboard,
): Promise<number> {
  const result = await call<TgMessage>("sendMessage", {
    chat_id: chatId,
    text,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
  return result.message_id;
}

/** Редактирует текст сообщения бота (и клавиатуру: без keyboard — снимает её). */
export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  keyboard?: TgInlineKeyboard,
): Promise<void> {
  await call("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  });
}

/** Убирает «часики» на кнопке; опционально показывает всплывающий текст. */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  // Ошибку глотаем: query мог протухнуть (Telegram держит его ~несколько минут),
  // а падать из-за этого не за чем.
  try {
    await call("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    });
  } catch (err) {
    console.error("answerCallbackQuery:", err);
  }
}
