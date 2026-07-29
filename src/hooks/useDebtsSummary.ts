import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { DebtsSummary } from "@/types";

/** Сводка активных долгов за период [from, to]. enabled — грузить только при открытом попапе. */
export function useDebtsSummary(from: string, to: string, enabled = true) {
  return useQuery({
    queryKey: ["debts-summary", from, to],
    queryFn: () => api.get<DebtsSummary>(`/api/debts/summary?from=${from}&to=${to}`),
    enabled,
  });
}
