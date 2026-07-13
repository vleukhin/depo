import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { TrxPrice } from "@/types";

/** Текущий курс TRX/USDT (≈ USD) для оценки суммарного TRX в долларах. */
export function useTrxPrice() {
  return useQuery({
    queryKey: ["trx-price"],
    queryFn: () => api.get<TrxPrice>("/api/trx-price"),
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
