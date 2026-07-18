export const SERVICES = ["Lets", "Mate", "N-Obmen", "Currex"] as const;
export type Service = (typeof SERVICES)[number];

// Размещение: внешний кошелёк или счёт на бирже.
export type PlacementKind = "wallet" | "exchange";

export const EXCHANGES = ["KuCoin", "Bitget"] as const;
export type Exchange = (typeof EXCHANGES)[number];

export const EXCHANGE_ACCOUNTS = ["spot", "main"] as const;
export type ExchangeAccount = (typeof EXCHANGE_ACCOUNTS)[number];

// Иконка размещения — выбирается вручную в настройках. null — без иконки.
export const PLACEMENT_ICONS = ["kucoin", "bitget", "onekey", "tangem"] as const;
export type PlacementIconId = (typeof PLACEMENT_ICONS)[number];

// Суммы во всех типах ниже — в десятичных USDT (micro-USDT остаётся внутри БД).
export interface Fund {
  id: number;
  name: string;
  amount: number;
  created_at: string;
  updated_at: string;
}

export interface Placement {
  id: number;
  name: string;
  amount: number;
  kind: PlacementKind;
  address: string | null; // только для kind = 'wallet'
  exchange: Exchange | null; // только для kind = 'exchange'
  exchange_account: ExchangeAccount | null; // тип счёта на бирже
  icon: PlacementIconId | null; // иконка размещения (выбирается вручную), NULL — без иконки
  comment: string | null;
  chain_checked_at: string | null; // когда сумма обновлялась из сети/с биржи, NULL — никогда
  trx_amount: number | null; // баланс нативного TRX (в TRX), NULL — не проверяли
  deleted_at: string | null; // мягкое удаление: NULL — активно
  created_at: string;
  updated_at: string;
}

export interface CheckBalancesResult {
  checked: number;
  failed: { id: number; name: string; error: string }[];
  skipped: number; // строки-кошельки без валидного TRON-адреса
}

// Данные для попапа пополнения TRX с биржи. Суммы — десятичные TRX.
export interface ExchangeTrxInfo {
  balance: number; // баланс TRX на спотовом счёте биржи
  fee: number | null; // комиссия сети за вывод, null — неизвестна
  min: number | null; // минимальная сумма вывода, null — неизвестна
}

export interface WithdrawTrxResult {
  orderId: string; // id заявки на вывод, созданной биржей
}

export interface Manager {
  id: number;
  name: string;
  telegram: string | null; // ник телеграм, NULL — не указан
  created_at: string;
  updated_at: string;
}

export interface Debt {
  id: number;
  manager_id: number | null; // FK -> managers; NULL быть не должно (форма требует выбор)
  manager_name: string | null; // подтягивается через LEFT JOIN
  amount: number;
  date: string; // дата долга (YYYY-MM-DD)
  service: Service | null;
  placement_id: number | null;
  placement_name: string | null; // подтягивается через LEFT JOIN
  source_text: string | null;
  comment: string | null;
  deleted_at: string | null; // мягкое удаление: NULL — активен
  placement_deleted_at: string | null; // источник-размещение в архиве (заполняется только в архивной выборке)
  created_at: string;
  updated_at: string;
}

export interface Summary {
  total_funds: number;
  total_placements: number;
  total_debts: number;
  total_trx: number; // суммарный TRX по всем размещениям (информационно, вне сверки)
  diff: number; // (размещено + долги) − депо: >0 избыток, <0 недостача
  balanced: boolean;
}

// Снимок состояния депо: строка списка (итоги без содержимого блоков).
export interface DepoSnapshot {
  id: number;
  comment: string | null;
  total_funds: number;
  total_placements: number;
  total_debts: number;
  total_trx: number; // суммарный TRX (информационно)
  diff: number; // (размещено + долги) − депо на момент снимка
  balanced: boolean;
  created_at: string; // UTC-момент создания снимка
}

// Полный снимок: замороженные копии всех блоков на момент создания.
export interface DepoSnapshotDetail extends DepoSnapshot {
  funds: Fund[];
  placements: Placement[];
  debts: Debt[];
}

// Снимок суммарного TRX за день. Сумма — десятичные TRX.
export interface TrxSnapshot {
  date: string; // календарный день по МСК (YYYY-MM-DD)
  trx_amount: number;
}

// Текущий курс TRX. Десятичные USDT (≈ USD) за 1 TRX; null — курс недоступен.
export interface TrxPrice {
  price: number | null;
}

// --- Telegram-бот: черновики долгов ---

export const TG_DRAFT_STATUSES = [
  "awaiting_amount",
  "awaiting_manager",
  "awaiting_service",
  "awaiting_confirmation",
  "done",
  "cancelled",
] as const;
export type TgDraftStatus = (typeof TG_DRAFT_STATUSES)[number];

// Черновик долга из пересланного боту сообщения. Диалог с ботом идёт через
// serverless-вебхук, поэтому всё состояние живёт в БД. Суммы — десятичные USDT.
export interface TgDraft {
  id: number;
  chat_id: number;
  status: TgDraftStatus;
  source_text: string | null; // оригинальный текст форварда (-> debts.source_text)
  amount: number | null; // NULL — сумма ещё не распознана
  manager_id: number | null; // FK -> managers, NULL — менеджер не определён
  manager_name: string | null; // кэш имени для сводки
  sender_username: string | null; // ник автора форварда (для сопоставления)
  destination: string | null; // «рапира» и т.п.
  repay_source: string | null; // «кукойн» и т.п.
  service: Service | null;
  comment: string | null; // собранный комментарий (-> debts.comment)
  prompt_message_id: number | null; // id сообщения бота с вопросом/клавиатурой
  confidence: "high" | "low" | null; // уверенность парсера
  created_at: string;
  updated_at: string;
}

// Результат разбора текста заявки (LLM или regex-фолбэк). Суммы — десятичные USDT.
export interface ParsedRequest {
  amount: number | null; // однозначно распознанная сумма
  amount_candidates: number[]; // кандидаты, если чисел несколько
  manager: string | null; // best-effort имя из текста («для Питера») — только подсказка
  destination: string | null; // куда отправить («рапира»)
  repay_source: string | null; // откуда вернут («кукойн»)
  service: Service | null; // только при явном совпадении с SERVICES
  needs_clarification: boolean;
  clarification_field: "amount" | "manager" | null;
  confidence: "high" | "low";
}
