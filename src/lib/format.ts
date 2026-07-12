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
