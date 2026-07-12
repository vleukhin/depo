// Конвертация между десятичным USDT (ввод/вывод) и целым micro-USDT (хранение).
export const MICRO = 1_000_000;

/** Десятичный USDT (число или строка) -> целое micro-USDT. */
export function toMicro(value: number | string): number {
  const n = typeof value === "string" ? Number(value.replace(",", ".").trim()) : value;
  if (!Number.isFinite(n)) {
    throw new Error("Некорректная сумма");
  }
  return Math.round(n * MICRO);
}

/** Целое micro-USDT -> число USDT (для JSON-ответа клиенту). */
export function fromMicro(micro: number): number {
  return micro / MICRO;
}
