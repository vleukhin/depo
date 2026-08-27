import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { NativePrices } from "@/types";

/** Текущие курсы TRX/BNB/ETH к USDT (≈ USD) — для оценки газа в долларах. */
export function useNativePrices() {
  return useQuery({
    queryKey: ["native-prices"],
    queryFn: () => api.get<NativePrices>("/api/native-prices"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
