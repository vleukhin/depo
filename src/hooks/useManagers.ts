import { createResourceHooks } from "@/hooks/createResourceHooks";
import type { Manager } from "@/types";
import type { ManagerInput } from "@/lib/validate";

// Переименование/удаление менеджера меняет manager_name в долгах (через JOIN),
// поэтому мутации дополнительно инвалидируют список долгов.
export const {
  useList: useManagers,
  useCreate: useCreateManager,
  useUpdate: useUpdateManager,
  useDelete: useDeleteManager,
} = createResourceHooks<Manager, ManagerInput>("managers", "managers", {
  invalidateKeys: ["debts"],
});
