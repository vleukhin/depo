import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TrxSnapshot } from "@/types";

/** История ежедневных снимков суммарного TRX за последние N дней. */
export function useTrxSnapshots(days: number) {
  return useQuery({
    queryKey: ["trx-snapshots", days],
    queryFn: () => api.get<TrxSnapshot[]>(`/api/trx-snapshots?days=${days}`),
  });
}
