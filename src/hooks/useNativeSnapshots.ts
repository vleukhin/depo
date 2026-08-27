import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Chain, NativeSnapshot } from "@/types";

/** История ежедневных снимков суммарного газа одной сети за последние N дней. */
export function useNativeSnapshots(chain: Chain, days: number) {
  return useQuery({
    queryKey: ["native-snapshots", chain, days],
    queryFn: () => api.get<NativeSnapshot[]>(`/api/native-snapshots?chain=${chain}&days=${days}`),
  });
}
