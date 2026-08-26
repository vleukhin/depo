import { createResourceHooks } from "@/hooks/createResourceHooks";
import type { TagWithUsage } from "@/types";
import type { TagInput } from "@/lib/validate";

// Переименование или смена цвета тега меняют чипы в свободных средствах,
// поэтому мутации дополнительно инвалидируют их список.
export const {
  useList: useTags,
  useCreate: useCreateTag,
  useUpdate: useUpdateTag,
  useDelete: useDeleteTag,
} = createResourceHooks<TagWithUsage, TagInput>("tags", "tags", {
  invalidateKeys: ["placements"],
});
