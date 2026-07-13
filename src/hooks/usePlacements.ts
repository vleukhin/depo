import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createResourceHooks } from "@/hooks/createResourceHooks";
import { api } from "@/lib/api";
import type {
  CheckBalancesResult,
  Exchange,
  ExchangeAccount,
  ExchangeTrxInfo,
  Placement,
  WithdrawTrxResult,
} from "@/types";
import type { PlacementInput, TrxWithdrawInput } from "@/lib/validate";

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
      // Сервер апсертит снимок TRX за сегодня — обновляем график (все периоды по префиксу).
      qc.invalidateQueries({ queryKey: ["trx-snapshots"] });
    },
  });
}

/** Баланс TRX и параметры вывода на бирже (для попапа пополнения). */
export function useExchangeTrxInfo(exchange: Exchange, account: ExchangeAccount, enabled: boolean) {
  return useQuery({
    queryKey: ["exchange-trx-info", exchange, account],
    queryFn: () =>
      api.get<ExchangeTrxInfo>(
        `/api/placements/exchange-trx-info?exchange=${exchange}&account=${account}`,
      ),
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Вывод TRX с биржи на адрес кошелька: сервер вызывает API биржи. */
export function useWithdrawTrx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TrxWithdrawInput) =>
      api.post<WithdrawTrxResult>("/api/placements/withdraw-trx", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["placements"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}
