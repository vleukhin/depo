import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { createResourceHooks } from "@/hooks/createResourceHooks";
import { api } from "@/lib/api";
import type {
  CheckBalancesResult,
  DayTransfers,
  EnergyRentalQuote,
  EnergyRentResult,
  Exchange,
  ExchangeAccount,
  Chain,
  ExchangeGasInfo,
  Placement,
  UsdtTransfersPage,
  WithdrawGasResult,
} from "@/types";
import type {
  EnergyRentInput,
  EnergyRentParams,
  GasWithdrawInput,
  PlacementInput,
} from "@/lib/validate";

export const {
  useList: usePlacements,
  useListDeleted: useDeletedPlacements,
  useCreate: useCreatePlacement,
  useUpdate: useUpdatePlacement,
  useDelete: useDeletePlacement,
  useRestore: useRestorePlacement,
  useReorder: useReorderPlacements,
} = createResourceHooks<Placement, PlacementInput>("placements", "placements", {
  // Смена тегов записи меняет usage_count на странице тегов.
  invalidateKeys: ["tags"],
});

/** Проверка балансов во всех сетях и на биржах: сервер перезаписывает суммы записей. */
export function useCheckBalances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<CheckBalancesResult>("/api/placements/check-balances", {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["placements"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
      // Сервер апсертит снимки газа за сегодня — обновляем график (все сети и периоды по префиксу).
      qc.invalidateQueries({ queryKey: ["native-snapshots"] });
    },
  });
}

/** Баланс нативной монеты сети и параметры её вывода на бирже (для попапа пополнения). */
export function useExchangeGasInfo(
  exchange: Exchange,
  chain: Chain,
  account: ExchangeAccount,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["exchange-gas-info", exchange, chain, account],
    queryFn: () =>
      api.get<ExchangeGasInfo>(
        `/api/placements/exchange-gas-info?exchange=${exchange}&chain=${chain}&account=${account}`,
      ),
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Переводы USDT по адресу кошелька — для попапа истории транзакций.
 * Постраничная подгрузка непрозрачным курсором источника (fingerprint у TronGrid,
 * номер страницы у Etherscan): «Показать ещё» в попапе.
 */
export function usePlacementTransactions(id: number, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["placement-transactions", id],
    queryFn: ({ pageParam }) =>
      api.get<UsdtTransfersPage>(
        `/api/placements/${id}/transactions` +
          (pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ""),
      ),
    initialPageParam: "",
    getNextPageParam: (last) => last.next ?? undefined,
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/**
 * Переводы USDT по всем внешним кошелькам за календарный день (МСК) —
 * для попапа «Транзакции» в шапке блока. Страницы собирает сервер, тут обычный запрос.
 */
export function useDayTransactions(date: string, enabled: boolean) {
  return useQuery({
    queryKey: ["day-transactions", date],
    queryFn: () => api.get<DayTransfers>(`/api/placements/transactions?date=${date}`),
    enabled,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Вывод газа с биржи на адрес кошелька: сервер вызывает API биржи. */
export function useWithdrawGas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GasWithdrawInput) =>
      api.post<WithdrawGasResult>("/api/placements/withdraw-gas", input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["placements"] });
      qc.invalidateQueries({ queryKey: ["summary"] });
    },
  });
}

/**
 * Котировка аренды энергии (+ bandwidth) в TronRental и баланс аккаунта.
 * Прошлая котировка держится на экране, пока грузится новая (смена параметров).
 */
export function useEnergyRentalQuote(params: EnergyRentParams, enabled: boolean) {
  const { transfers, newRecipient, bandwidth } = params;
  return useQuery({
    queryKey: ["energy-rental-quote", transfers, newRecipient, bandwidth],
    queryFn: () =>
      api.get<EnergyRentalQuote>(
        `/api/placements/energy-rental-quote?transfers=${transfers}` +
          `&newRecipient=${newRecipient ? 1 : 0}&bandwidth=${bandwidth}`,
      ),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

/** Аренда энергии в TronRental на адрес кошелька: баланс TRX записи не меняется. */
export function useRentEnergy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EnergyRentInput) =>
      api.post<EnergyRentResult>("/api/placements/rent-energy", input),
    onSuccess: () => {
      // Списание с баланса TronRental — котировки показывают устаревший баланс.
      qc.invalidateQueries({ queryKey: ["energy-rental-quote"] });
    },
  });
}
