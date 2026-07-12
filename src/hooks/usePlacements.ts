import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createResourceHooks } from "@/hooks/createResourceHooks";
import { api } from "@/lib/api";
import type { CheckBalancesResult, Placement } from "@/types";
import type { PlacementInput } from "@/lib/validate";

export const {
  useList: usePlacements,
  useCreate: useCreatePlacement,
  useUpdate: useUpdatePlacement,
  useDelete: useDeletePlacement,
  useReorder: useReorderPlacements,
} = createResourceHooks<Placement, PlacementInput>("placements", "placements");

/** Проверка балансов в сети TRON: сервер перезаписывает суммы размещений. */
export function useCheckBalances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<CheckBalancesResult>("/api/placements/check-balances", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["placements"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}
