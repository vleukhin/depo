import { cn } from "@/lib/utils";
import { formatUsdt, formatUsdtSigned } from "@/lib/format";

/** Иконка USDT (Tether): бирюзовая монета с белым знаком ₮. Размер задаётся через className. */
export function UsdtIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="img"
      aria-label="USDT"
      className={cn("inline-block", className)}
    >
      <circle cx="12" cy="12" r="12" fill="#26A17B" />
      <g fill="#fff">
        <rect x="6.2" y="6.5" width="11.6" height="2.2" rx="0.5" />
        <rect x="10.9" y="6.5" width="2.2" height="11" rx="0.4" />
        <rect x="8" y="10.6" width="8" height="1.9" rx="0.4" />
      </g>
    </svg>
  );
}

/** Сумма с иконкой USDT вместо текста: «1 235 ₮». `signed` — со знаком (+/−). */
export function UsdtAmount({
  value,
  signed = false,
  className,
  iconClassName,
}: {
  value: number;
  signed?: boolean;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 tabular-nums", className)}>
      {signed ? formatUsdtSigned(value) : formatUsdt(value)}
      <UsdtIcon className={cn("size-3.5 shrink-0", iconClassName)} />
    </span>
  );
}
