import { createResourceHooks } from "@/hooks/createResourceHooks";
import type { Debt } from "@/types";
import type { DebtInput } from "@/lib/validate";

export const {
  useList: useDebts,
  useCreate: useCreateDebt,
  useUpdate: useUpdateDebt,
  useDelete: useDeleteDebt,
  useReorder: useReorderDebts,
} = createResourceHooks<Debt, DebtInput>("debts", "debts");
