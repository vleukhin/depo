// Минимальные типы Telegram Bot API — только то, что использует бот.
// Полная спецификация: https://core.telegram.org/bots/api

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface TgChat {
  id: number;
}

// Источник пересланного сообщения (Bot API 7.0+). Для скрытых аккаунтов
// приходит hidden_user с одним лишь отображаемым именем.
export interface TgForwardOrigin {
  type: "user" | "hidden_user" | "chat" | "channel";
  sender_user?: TgUser; // type = 'user'
  sender_user_name?: string; // type = 'hidden_user'
}

export interface TgMessage {
  message_id: number;
  chat: TgChat;
  from?: TgUser;
  text?: string;
  forward_origin?: TgForwardOrigin;
  // Устаревшие поля форварда (до Bot API 7.0) — на всякий случай.
  forward_from?: TgUser;
  forward_sender_name?: string;
  reply_to_message?: { message_id: number };
}

export interface TgCallbackQuery {
  id: string;
  from: TgUser;
  message?: TgMessage; // сообщение бота, под которым нажата кнопка
  data?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

export interface TgInlineKeyboardButton {
  text: string;
  callback_data: string; // ≤ 64 байт
}

export type TgInlineKeyboard = TgInlineKeyboardButton[][];

/** Является ли сообщение форвардом (новое поле или legacy). */
export function isForwarded(msg: TgMessage): boolean {
  return !!(msg.forward_origin || msg.forward_from || msg.forward_sender_name);
}

/** Ник автора форварда (без @), если он доступен. */
export function forwardUsername(msg: TgMessage): string | null {
  const username = msg.forward_origin?.sender_user?.username ?? msg.forward_from?.username;
  return username ? username.replace(/^@/, "") : null;
}

/** Отображаемое имя автора форварда — подсказка, когда ник недоступен. */
export function forwardDisplayName(msg: TgMessage): string | null {
  const user = msg.forward_origin?.sender_user ?? msg.forward_from;
  if (user) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
    return name || user.username || null;
  }
  return msg.forward_origin?.sender_user_name ?? msg.forward_sender_name ?? null;
}
