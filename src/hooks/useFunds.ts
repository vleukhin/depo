import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createResourceHooks } from "@/hooks/createResourceHooks";
import { api } from "@/lib/api";
import type { ArchivePage, Fund, FundChange } from "@/types";
import type { FundInput } from "@/lib/validate";

export const {
  useList: useFunds,
  useCreate: useCreateFund,
  useUpdate: useUpdateFund,
  useDelete: useDeleteFund,
} = createResourceHooks<Fund, FundInput>("funds", "funds", {
  // Каждая правка средств дописывает строку в историю состава депо.
  invalidateKeys: ["fund-history"],
});

/** История изменений состава депо, постранично (новые сверху). */
export function useFundHistory(page: number) {
  return useQuery({
    queryKey: ["fund-history", page],
    queryFn: () => api.get<ArchivePage<FundChange>>(`/api/funds/history?page=${page}`),
    // Пока грузится новая страница, показываем прежнюю — без мигания пустого списка.
    placeholderData: keepPreviousData,
  });
}
