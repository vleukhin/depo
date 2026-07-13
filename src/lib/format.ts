const usdtFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

/** Форматирует число суммы без единицы: 1234.5 -> "1 235" (ru-RU, целые). */
export function formatAmount(value: number): string {
  return usdtFormatter.format(value);
}

/** 1234.5 -> "1 235" (единица USDT отображается иконкой, см. UsdtAmount). */
export function formatUsdt(value: number): string {
  return usdtFormatter.format(value);
}

/** Со знаком: 550 -> "+550", -20 -> "−20". */
export function formatUsdtSigned(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${usdtFormatter.format(Math.abs(value))}`;
}

const dateFormatter = new Intl.DateTimeFormat("ru-RU");

/** "2026-07-12" или Date -> "12.07.2026" */
export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  return dateFormatter.format(d);
}

const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
});

/** "2026-07-12" -> "12.07" (подписи оси X графика). */
export function formatDateShort(value: string): string {
  return shortDateFormatter.format(new Date(`${value}T00:00:00`));
}
