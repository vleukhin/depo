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

/**
 * Точная конвертация десятичной строки в micro-USDT без float
 * (биржи отдают балансы строками; знаки после шестого отбрасываются).
 */
export function decimalToMicro(value: string): number {
  const m = /^(\d+)(?:\.(\d*))?$/.exec(value.trim());
  if (!m) {
    throw new Error(`Некорректная сумма: ${value}`);
  }
  const frac = (m[2] ?? "").padEnd(6, "0").slice(0, 6);
  const micro = BigInt(m[1]) * BigInt(MICRO) + BigInt(frac);
  if (micro > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Сумма выходит за пределы точности: ${value}`);
  }
  return Number(micro);
}

/**
 * Сырые base units токена -> целые micro-единицы (× 1 000 000).
 * Нужна для EVM: у BEP-20 USDT 18 знаков, у нативных BNB/ETH тоже 18 —
 * прямое приведение к Number переполнило бы безопасный диапазон, поэтому
 * масштабируем на BigInt (знаки после шестого отбрасываются).
 */
export function baseUnitsToMicro(raw: bigint, decimals: number): number {
  const micro =
    decimals >= 6 ? raw / 10n ** BigInt(decimals - 6) : raw * 10n ** BigInt(6 - decimals);
  if (micro > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("Баланс превышает безопасный диапазон");
  }
  return Number(micro);
}
