import { createResourceHooks } from "@/hooks/createResourceHooks";
import type { Fund } from "@/types";
import type { FundInput } from "@/lib/validate";

export const {
  useList: useFunds,
  useCreate: useCreateFund,
  useUpdate: useUpdateFund,
  useDelete: useDeleteFund,
} = createResourceHooks<Fund, FundInput>("funds", "funds");
