// Конечный автомат диалога Telegram-бота. Состояние черновика живёт в БД
// (tg_drafts) — между вызовами serverless-вебхука памяти нет.
//
// Поток: форвард → парсинг + резолв менеджера → awaiting_amount / awaiting_manager
// → awaiting_confirmation (сводка; выбор сервиса — кнопками прямо в ней)
// → confirm → createDebt → done.

import { formatUsdt } from "@/lib/format";
import {
  createDebt,
  createTgDraft,
  getLatestAwaitingTgDraft,
  getManager,
  getTgDraft,
  getTgDraftByPrompt,
  listManagers,
  updateTgDraft,
} from "@/lib/repo";
import { answerCallbackQuery, editMessageText, sendMessage } from "@/lib/telegram/client";
import { resolveManager } from "@/lib/telegram/manager";
import { parseAmountReply, parseLoanRequest } from "@/lib/telegram/parse";
import type {
  TgCallbackQuery,
  TgInlineKeyboard,
  TgMessage,
  TgUpdate,
} from "@/lib/telegram/types";
import { SERVICES, type Service, type TgDraft, type TgDraftStatus } from "@/types";

export async function handleUpdate(update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(update.callback_query);
  if (update.message) return handleMessage(update.message);
}

// ---------- входящие сообщения ----------

async function handleMessage(msg: TgMessage): Promise<void> {
  const text = msg.text?.trim();
  if (!text) {
    await sendMessage(msg.chat.id, "Пришлите (или перешлите) текст заявки на долг.");
    return;
  }

  // Уточнение по конкретному черновику: ответ на сообщение бота с вопросом.
  if (msg.reply_to_message) {
    const draft = await getTgDraftByPrompt(msg.chat.id, msg.reply_to_message.message_id);
    if (draft && draft.status.startsWith("awaiting_")) {
      return handleFollowUpText(draft, msg, text);
    }
  }

  // Обычный текст без форварда, пока бот ждёт сумму — считаем его ответом.
  if (!msg.forward_origin && !msg.forward_from && !msg.forward_sender_name) {
    const latest = await getLatestAwaitingTgDraft(msg.chat.id);
    if (latest?.status === "awaiting_amount") {
      return handleFollowUpText(latest, msg, text);
    }
  }

  return startDraft(msg, text);
}

/** Новый черновик из форварда (или прямого текста заявки). */
async function startDraft(msg: TgMessage, text: string): Promise<void> {
  const [parsed, resolved] = await Promise.all([parseLoanRequest(text), resolveManager(msg)]);

  // Однозначная сумма: либо распознана, либо единственный кандидат.
  const amount =
    parsed.amount ?? (parsed.amount_candidates.length === 1 ? parsed.amount_candidates[0] : null);

  const status: TgDraftStatus =
    amount === null
      ? "awaiting_amount"
      : resolved.managerId === null
        ? "awaiting_manager"
        : "awaiting_confirmation";

  const draft = await createTgDraft({
    chat_id: msg.chat.id,
    status,
    // Оригинальный текст форварда сохраняем в comment (в source_text долга не пишем).
    source_text: null,
    amount,
    manager_id: resolved.managerId,
    manager_name: resolved.managerName,
    sender_username: resolved.username,
    destination: parsed.destination,
    repay_source: parsed.repay_source,
    service: parsed.service,
    comment: text,
    confidence: parsed.confidence,
  });

  const prompt = await renderPrompt(draft, {
    amountCandidates: parsed.amount_candidates,
    displayName: resolved.displayName,
  });
  const messageId = await sendMessage(draft.chat_id, prompt.text, prompt.keyboard);
  await updateTgDraft(draft.id, { prompt_message_id: messageId });
}

/** Текстовый ответ-уточнение: сейчас ботом ожидается только сумма. */
async function handleFollowUpText(draft: TgDraft, msg: TgMessage, text: string): Promise<void> {
  if (draft.status !== "awaiting_amount") {
    await sendMessage(msg.chat.id, "Выберите вариант кнопками под сообщением выше.");
    return;
  }
  const amount = parseAmountReply(text);
  if (amount === null) {
    await sendMessage(msg.chat.id, "Не понял сумму. Введите одно число в USDT, например: 9200");
    return;
  }
  const updated = await updateTgDraft(draft.id, {
    amount,
    status: nextStatus({ ...draft, amount }),
  });
  if (!updated) return;
  const prompt = await renderPrompt(updated);
  const messageId = await sendMessage(updated.chat_id, prompt.text, prompt.keyboard);
  await updateTgDraft(updated.id, { prompt_message_id: messageId });
}

// ---------- callback-кнопки ----------

async function handleCallback(cb: TgCallbackQuery): Promise<void> {
  const data = cb.data ?? "";
  const [action, idStr, arg] = data.split(":");
  const draftId = Number(idStr);
  const chatId = cb.message?.chat.id;
  const messageId = cb.message?.message_id;

  if (!Number.isInteger(draftId) || chatId === undefined || messageId === undefined) {
    await answerCallbackQuery(cb.id);
    return;
  }

  const draft = await getTgDraft(draftId);
  // Защита от двойного тапа и протухших кнопок: черновик должен быть «живым».
  if (!draft || draft.chat_id !== chatId || !draft.status.startsWith("awaiting_")) {
    await answerCallbackQuery(cb.id, "Уже неактуально");
    return;
  }

  switch (action) {
    case "amount": {
      if (draft.status !== "awaiting_amount") break;
      const amount = Number(arg);
      if (!Number.isFinite(amount) || amount <= 0) break;
      const updated = await updateTgDraft(draft.id, {
        amount,
        status: nextStatus({ ...draft, amount }),
      });
      if (updated) await rerender(updated, messageId);
      break;
    }
    case "manager": {
      if (draft.status !== "awaiting_manager") break;
      const manager = await getManager(Number(arg));
      if (!manager) {
        await answerCallbackQuery(cb.id, "Менеджер не найден");
        return;
      }
      const updated = await updateTgDraft(draft.id, {
        manager_id: manager.id,
        manager_name: manager.name,
        status: nextStatus({ ...draft, manager_id: manager.id }),
      });
      if (updated) await rerender(updated, messageId);
      break;
    }
    case "service": {
      if (draft.status !== "awaiting_confirmation") break;
      const service =
        arg === "none" ? null : SERVICES.includes(arg as Service) ? (arg as Service) : undefined;
      if (service === undefined) break;
      const updated = await updateTgDraft(draft.id, { service });
      if (updated) await rerender(updated, messageId);
      break;
    }
    case "edit_amount": {
      const updated = await updateTgDraft(draft.id, { status: "awaiting_amount" });
      if (updated) await rerender(updated, messageId);
      break;
    }
    case "pick_manager": {
      const updated = await updateTgDraft(draft.id, { status: "awaiting_manager" });
      if (updated) await rerender(updated, messageId);
      break;
    }
    case "confirm": {
      if (draft.status !== "awaiting_confirmation") break;
      if (draft.amount === null || draft.manager_id === null) {
        // Прямых путей сюда без суммы/менеджера нет, но подстрахуемся.
        const updated = await updateTgDraft(draft.id, { status: nextStatus(draft) });
        if (updated) await rerender(updated, messageId);
        break;
      }
      const debt = await createDebt({
        manager_id: draft.manager_id,
        amount: draft.amount,
        date: new Date().toISOString().slice(0, 10),
        service: draft.service,
        placement_id: null,
        // Оригинальный текст форварда — в comment; source_text не заполняем.
        source_text: null,
        comment: draft.comment,
      });
      await updateTgDraft(draft.id, { status: "done" });
      await editMessageText(
        chatId,
        messageId,
        `✅ Долг создан (#${debt.id})\n${summaryText({ ...draft, status: "done" })}`,
      );
      break;
    }
    case "cancel": {
      await updateTgDraft(draft.id, { status: "cancelled" });
      await editMessageText(chatId, messageId, "❌ Черновик отменён.");
      break;
    }
  }

  await answerCallbackQuery(cb.id);
}

// ---------- переходы и рендер ----------

/** Следующее состояние по заполненности черновика (идемпотентно). */
function nextStatus(draft: Pick<TgDraft, "amount" | "manager_id">): TgDraftStatus {
  if (draft.amount === null) return "awaiting_amount";
  if (draft.manager_id === null) return "awaiting_manager";
  return "awaiting_confirmation";
}

/** Перерисовывает сообщение бота под новое состояние черновика. */
async function rerender(draft: TgDraft, messageId: number): Promise<void> {
  const prompt = await renderPrompt(draft);
  await editMessageText(draft.chat_id, messageId, prompt.text, prompt.keyboard);
  await updateTgDraft(draft.id, { prompt_message_id: messageId });
}

interface RenderExtras {
  amountCandidates?: number[];
  displayName?: string | null;
}

async function renderPrompt(
  draft: TgDraft,
  extras: RenderExtras = {},
): Promise<{ text: string; keyboard?: TgInlineKeyboard }> {
  switch (draft.status) {
    case "awaiting_amount": {
      const candidates = extras.amountCandidates ?? [];
      const keyboard: TgInlineKeyboard | undefined = candidates.length
        ? chunk(
            candidates.map((c) => ({
              text: `${formatUsdt(c)} USDT`,
              callback_data: `amount:${draft.id}:${c}`,
            })),
            2,
          )
        : undefined;
      const hint = candidates.length
        ? "В сообщении несколько чисел — выберите сумму кнопкой или ответьте на это сообщение суммой в USDT."
        : "Не смог распознать сумму. Ответьте на это сообщение суммой в USDT, например: 9200";
      return { text: `${summaryText(draft)}\n\n${hint}`, keyboard };
    }
    case "awaiting_manager": {
      const managers = await listManagers();
      if (managers.length === 0) {
        return {
          text: `${summaryText(draft)}\n\nСправочник менеджеров пуст. Добавьте менеджера в разделе «Менеджеры» приложения и перешлите сообщение ещё раз.`,
        };
      }
      const who = draft.sender_username
        ? `@${draft.sender_username} не привязан к менеджеру.`
        : extras.displayName
          ? `Не удалось определить менеджера по форварду от «${extras.displayName}».`
          : "Не удалось определить менеджера.";
      const keyboard = chunk(
        managers.map((m) => ({ text: m.name, callback_data: `manager:${draft.id}:${m.id}` })),
        2,
      );
      return {
        text: `${summaryText(draft)}\n\n${who} Выберите, кто берёт в долг (привязать ник можно в разделе «Менеджеры»):`,
        keyboard,
      };
    }
    default: {
      // awaiting_confirmation: сводка + выбор сервиса + подтверждение.
      const serviceRow = SERVICES.map((s) => ({
        text: draft.service === s ? `• ${s}` : s,
        callback_data: `service:${draft.id}:${s}`,
      }));
      const keyboard: TgInlineKeyboard = [
        serviceRow.slice(0, 2),
        serviceRow.slice(2),
        [
          {
            text: draft.service === null ? "• Без сервиса" : "Без сервиса",
            callback_data: `service:${draft.id}:none`,
          },
        ],
        [
          { text: "✏️ Сумма", callback_data: `edit_amount:${draft.id}` },
          { text: "👤 Менеджер", callback_data: `pick_manager:${draft.id}` },
        ],
        [
          { text: "✅ Создать", callback_data: `confirm:${draft.id}` },
          { text: "❌ Отмена", callback_data: `cancel:${draft.id}` },
        ],
      ];
      return { text: `${summaryText(draft)}\n\nВсё верно? Можно выбрать сервис.`, keyboard };
    }
  }
}

function summaryText(draft: TgDraft): string {
  const lines = [
    "Новый долг:",
    `Менеджер: ${draft.manager_name ?? "не определён"}`,
    `Сумма: ${draft.amount === null ? "не указана" : `${formatUsdt(draft.amount)} USDT`}`,
    `Сервис: ${draft.service ?? "—"}`,
  ];
  if (draft.comment) lines.push(`Комментарий: ${draft.comment}`);
  return lines.join("\n");
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    rows.push(items.slice(i, i + size));
  }
  return rows;
}
