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
    place: optionalText,
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
  comment: optionalText,
});

export const reorderInput = z.object({
  ids: z.array(z.number().int().positive()).min(1),
});

export type FundInput = z.infer<typeof fundInput>;
export type ManagerInput = z.infer<typeof managerInput>;
export type PlacementInput = z.infer<typeof placementInput>;
export type DebtInput = z.infer<typeof debtInput>;

// input-типы для react-hook-form (до zod-трансформаций).
export type FundFormValues = z.input<typeof fundInput>;
export type ManagerFormValues = z.input<typeof managerInput>;
export type PlacementFormValues = z.input<typeof placementInput>;
