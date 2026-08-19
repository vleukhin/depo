import { mskDayRange } from "@/lib/format";
import { findDebtsByTxIds, listWalletPlacementsWithAddress } from "@/lib/repo";
import { fetchUsdtTransfersInRange, isTronAddress } from "@/lib/tron";
import type { DayTransfers, WalletTransfer } from "@/types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ключ перевода внутри дня. Не tx_id: одна транзакция может нести несколько
 * переводов, а перевод между двумя нашими кошельками приходит дважды —
 * как исходящий у отправителя и как входящий у получателя.
 */
const transferKey = (t: { tx_id: string; from: string; to: string; amount: number }) =>
  `${t.tx_id}|${t.from.toLowerCase()}|${t.to.toLowerCase()}|${t.amount}`;

/**
 * Переводы USDT (TRC-20) по всем активным внешним кошелькам за календарный день по МСК.
 * Кошельки обходятся последовательно с той же паузой, что в проверке балансов —
 * лимиты TronGrid общие. Ошибка по одному кошельку не рушит выдачу: она уезжает
 * в `failed`, остальные строки показываются.
 */
export async function collectDayTransfers(date: string): Promise<DayTransfers> {
  const { from, to } = mskDayRange(date);
  const result: DayTransfers = { date, transfers: [], failed: [], truncated: false };

  // Переводы между своими кошельками схлопываем в одну строку: оставляем
  // исходящую (её placement_id нужен форме долга) и помечаем второй кошелёк.
  const byKey = new Map<string, WalletTransfer>();

  for (const { id, name, address } of await listWalletPlacementsWithAddress()) {
    if (!isTronAddress(address)) continue;
    try {
      const page = await fetchUsdtTransfersInRange(address, from, to);
      result.truncated = result.truncated || page.truncated;
      for (const t of page.transfers) {
        const key = transferKey(t);
        const seen = byKey.get(key);
        if (!seen) {
          byKey.set(key, { ...t, placement_id: id, placement_name: name });
          continue;
        }
        // Тот же перевод с другой стороны: одна строка со ссылкой на второй кошелёк.
        if (seen.direction === "out") {
          seen.internal_with = name;
        } else {
          byKey.set(key, {
            ...t,
            placement_id: id,
            placement_name: name,
            internal_with: seen.placement_name,
          });
        }
      }
    } catch (e) {
      result.failed.push({ id, name, error: e instanceof Error ? e.message : "Ошибка запроса" });
    }
    await sleep(process.env.TRONGRID_API_KEY ? 100 : 600);
  }

  const transfers = [...byKey.values()].sort((a, b) => b.timestamp - a.timestamp);

  // Метки «долг уже создан» — одним запросом по всем транзакциям дня.
  const debts = await findDebtsByTxIds([...new Set(transfers.map((t) => t.tx_id))]);
  result.transfers = transfers.map((t) => ({ ...t, debt: debts.get(t.tx_id) ?? null }));

  return result;
}
