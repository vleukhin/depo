import { z } from "zod";
import { SERVICES } from "@/types";

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

export const placementInput = z.object({
  name: z.string().trim().min(1, "Укажите название").max(200),
  amount,
  place: optionalText,
  address: optionalText,
  comment: optionalText,
});

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
