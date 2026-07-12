import { z } from "zod";
import { EXCHANGE_ACCOUNTS, EXCHANGES, SERVICES } from "@/types";

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
  manager: z.string().trim().min(1, "Укажите менеджера").max(200),
  amount,
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
  comment: optionalText,
});

export const reorderInput = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export type FundInput = z.infer<typeof fundInput>;
export type PlacementInput = z.infer<typeof placementInput>;
export type DebtInput = z.infer<typeof debtInput>;

// input-типы для react-hook-form (до zod-трансформаций).
export type FundFormValues = z.input<typeof fundInput>;
export type PlacementFormValues = z.input<typeof placementInput>;
