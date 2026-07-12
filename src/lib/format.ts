const usdtFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

/** 1234.5 -> "1 235 USDT" */
export function formatUsdt(value: number): string {
  return `${usdtFormatter.format(value)} USDT`;
}

/** Со знаком: 550 -> "+550 USDT", -20 -> "−20 USDT" */
export function formatUsdtSigned(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${usdtFormatter.format(Math.abs(value))} USDT`;
}
