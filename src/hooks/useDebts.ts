import { createResourceHooks } from "@/hooks/createResourceHooks";
import type { Debt } from "@/types";
import type { DebtInput } from "@/lib/validate";

export const {
  useList: useDebts,
  useListDeleted: useDeletedDebts,
  useCreate: useCreateDebt,
  useUpdate: useUpdateDebt,
  useDelete: useDeleteDebt,
  useRestore: useRestoreDebt,
  useReorder: useReorderDebts,
} = createResourceHooks<Debt, DebtInput>("debts", "debts");
