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

/** "2026-07-12" -> Date в локальном поясе (без сдвига на UTC). */
export function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date -> "2026-07-12" в локальном поясе. */
export function toYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Часовой пояс МСК фиксирован (UTC+3, без перехода на летнее время) — тот же день,
// по которому считаются снимки газа (date(datetime('now','+3 hours')) в БД).
export const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;

/** "2026-07-12" -> границы суток по МСК в мс от эпохи (обе включительно). */
export function mskDayRange(ymd: string): { from: number; to: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  const from = Date.UTC(y, m - 1, d) - MSK_OFFSET_MS;
  return { from, to: from + 86_400_000 - 1 };
}

const mskTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Moscow",
});

/** Метка времени блока (мс от эпохи) -> "21:30" по МСК. */
export function formatMskTime(ms: number): string {
  return mskTimeFormatter.format(ms);
}

const dateFormatter = new Intl.DateTimeFormat("ru-RU");

/** "2026-07-12" или Date -> "12.07.2026" */
export function formatDate(value: string | Date): string {
  const d = typeof value === "string" ? new Date(`${value}T00:00:00`) : value;
  return dateFormatter.format(d);
}

const dateTimeFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** UTC-строка БД "2026-07-12 18:30:00" -> "12.07.2026, 21:30" в местном времени. */
export function formatDateTime(utc: string): string {
  return dateTimeFormatter.format(new Date(`${utc.replace(" ", "T")}Z`));
}

const shortDateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
});

/** "2026-07-12" -> "12.07" (подписи оси X графика). */
export function formatDateShort(value: string): string {
  return shortDateFormatter.format(new Date(`${value}T00:00:00`));
}
