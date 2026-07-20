import { z } from "zod";
import { EXCHANGE_ACCOUNTS, EXCHANGES, PLACEMENT_ICONS, SERVICES } from "@/types";

// Суммы приходят с клиента в десятичных USDT (валидное число; форма шлёт number).
const amount = z
  .number({ message: "Укажите сумму" })
  .min(0, "Сумма не может быть отрицательной");

const optionalText = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const fundInput = z.object({
  name: z.string().trim().min(1, "Укажите название").max(200),
  amount,
});

export const managerInput = z.object({
  name: z.string().trim().min(1, "Укажите имя").max(200),
  telegram: optionalText,
});

export const placementInput = z
  .object({
    name: z.string().trim().min(1, "Укажите название").max(200),
    amount,
    kind: z
      .enum(["wallet", "exchange"], { message: "Некорректный тип размещения" })
      .default("wallet"),
    address: optionalText,
    exchange: z
      .enum(EXCHANGES, { message: "Некорректная биржа" })
      .nullish()
      .transform((v) => v ?? null),
    exchange_account: z
      .enum(EXCHANGE_ACCOUNTS, { message: "Некорректный тип счёта" })
      .nullish()
      .transform((v) => v ?? null),
    icon: z
      .enum(PLACEMENT_ICONS, { message: "Некорректная иконка" })
      .nullish()
      .transform((v) => v ?? null),
    comment: optionalText,
  })
  .superRefine((v, ctx) => {
    if (v.kind === "exchange") {
      if (!v.exchange) {
        ctx.addIssue({ code: "custom", path: ["exchange"], message: "Выберите биржу" });
      }
      if (!v.exchange_account) {
        ctx.addIssue({ code: "custom", path: ["exchange_account"], message: "Выберите тип счёта" });
      }
    }
  })
  // Поля неактивной ветки обнуляются, чтобы в БД не оседали противоречивые значения.
  .transform((v) =>
    v.kind === "exchange"
      ? { ...v, address: null }
      : { ...v, exchange: null, exchange_account: null },
  );

export const debtInput = z.object({
  manager_id: z.number({ message: "Выберите менеджера" }).int().positive("Выберите менеджера"),
  amount,
  date: z.iso
    .date({ message: "Некорректная дата" })
    .default(() => new Date().toISOString().slice(0, 10)),
  service: z
    .enum(SERVICES)
    .nullish()
    .transform((v) => v ?? null),
  placement_id: z
    .number()
    .int()
    .positive()
    .nullish()
    .transform((v) => v ?? null),
  source_text: optionalText,
  tx_id: optionalText,
  comment: optionalText,
});

// Снимок состояния депо: с клиента приходит только необязательный комментарий.
export const snapshotInput = z.object({
  comment: optionalText,
});

export const reorderInput = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

// Ввод для вывода TRX с биржи на адрес кошелька. Адрес получателя сервер берёт
// из сохранённого размещения по placementId — клиент шлёт только его id. Счёт-
// источник фиксирован (spot), поэтому в схему не выносится.
export const trxWithdrawInput = z.object({
  placementId: z.number({ message: "Некорректное размещение" }).int().positive(),
  exchange: z.enum(EXCHANGES, { message: "Некорректная биржа" }),
  amount: z.number({ message: "Укажите сумму" }).positive("Сумма должна быть больше нуля"),
});

// Результат разбора заявки на долг из Telegram (LLM возвращает JSON по этой схеме;
// regex-фолбэк собирает тот же контракт). Суммы — десятичные USDT.
export const parsedRequest = z.object({
  amount: z.number().min(0).nullable(),
  amount_candidates: z.array(z.number().min(0)),
  manager: z.string().trim().max(200).nullable(),
  destination: z.string().trim().max(200).nullable(),
  repay_source: z.string().trim().max(200).nullable(),
  service: z.enum(SERVICES).nullable(),
  needs_clarification: z.boolean(),
  clarification_field: z.enum(["amount", "manager"]).nullable(),
  confidence: z.enum(["high", "low"]),
});

export type FundInput = z.infer<typeof fundInput>;
export type ManagerInput = z.infer<typeof managerInput>;
export type PlacementInput = z.infer<typeof placementInput>;
export type DebtInput = z.infer<typeof debtInput>;
export type SnapshotInput = z.infer<typeof snapshotInput>;
export type TrxWithdrawInput = z.infer<typeof trxWithdrawInput>;
export type ParsedRequestOutput = z.infer<typeof parsedRequest>;

// input-типы для react-hook-form (до zod-трансформаций).
export type FundFormValues = z.input<typeof fundInput>;
export type ManagerFormValues = z.input<typeof managerInput>;
export type PlacementFormValues = z.input<typeof placementInput>;
