import { cn } from "@/lib/utils";
import { CHAIN_META } from "@/lib/chains";
import type { Chain } from "@/types";

/**
 * Иконка нативной монеты сети: TRX (TRON), BNB (BSC) или ETH (Ethereum).
 * `label` перекрывает подпись для читалок — та же монета обозначает и саму
 * сеть (в строке перевода она стоит рядом с суммой в USDT, а не с балансом газа).
 */
export function NativeIcon({
  chain,
  className,
  label = CHAIN_META[chain].native,
}: {
  chain: Chain;
  className?: string;
  label?: string;
}) {
  const common = {
    viewBox: "0 0 32 32",
    role: "img" as const,
    "aria-label": label,
    className: cn("inline-block", className),
  };

  if (chain === "bsc") {
    // BNB: жёлтая монета с фирменным «крестом» из ромбов.
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="16" fill="#F3BA2F" />
        <g fill="#fff">
          <polygon points="16,6.4 19.2,9.6 16,12.8 12.8,9.6" />
          <polygon points="9.6,12.8 12.8,16 9.6,19.2 6.4,16" />
          <polygon points="22.4,12.8 25.6,16 22.4,19.2 19.2,16" />
          <polygon points="16,19.2 19.2,22.4 16,25.6 12.8,22.4" />
          <polygon points="16,12.8 19.2,16 16,19.2 12.8,16" />
        </g>
      </svg>
    );
  }

  if (chain === "ethereum") {
    // ETH: сине-фиолетовая монета с гранёным ромбом.
    return (
      <svg {...common}>
        <circle cx="16" cy="16" r="16" fill="#627EEA" />
        <g fill="#fff">
          <path fillOpacity=".6" d="M16 4v8.87l7.5 3.35L16 4z" />
          <path d="M16 4L8.5 16.22 16 12.87V4z" />
          <path fillOpacity=".6" d="M16 21.97V28l7.5-10.38L16 21.97z" />
          <path d="M16 28v-6.03L8.5 17.62 16 28z" />
          <path fillOpacity=".2" d="M16 20.57l7.5-4.35L16 12.87v7.7z" />
          <path fillOpacity=".6" d="M8.5 16.22l7.5 4.35v-7.7l-7.5 3.35z" />
        </g>
      </svg>
    );
  }

  // TRX: красная монета с белым фирменным знаком.
  return (
    <svg {...common}>
      <circle cx="16" cy="16" r="16" fill="#EF0027" />
      <path
        fill="#fff"
        d="M21.932 9.913L7.5 7.257l7.595 19.112 10.583-12.894-3.746-3.562zm-.232 1.17l2.208 2.099-6.038 1.093 3.83-3.192zm-5.142 2.973l-6.364-5.278 10.402 1.914-4.038 3.364zm-.453.934l-1.038 8.58L9.472 9.487l6.633 5.502zm.96.455l6.687-1.21-7.67 9.343.983-8.133z"
      />
    </svg>
  );
}

// TRX показываем целыми, а для BNB и ETH сохраняем дробную часть: округление
// до целых превратило бы, например, 0.05 ETH в «0».
const formatters = [0, 2, 4].map(
  (digits) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }),
);

export function formatGas(chain: Chain, value: number): string {
  if (chain === "tron") return formatters[0].format(value);

  const abs = Math.abs(value);
  const formatter = abs >= 1000 ? formatters[0] : abs >= 1 ? formatters[1] : formatters[2];
  return formatter.format(value);
}

/** Баланс газа с иконкой монеты вместо тикера: «231 ◈». */
export function GasAmount({
  chain,
  value,
  className,
  iconClassName,
}: {
  chain: Chain;
  value: number;
  className?: string;
  iconClassName?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular-nums", className)}
      title={CHAIN_META[chain].native}
    >
      {formatGas(chain, value)}
      <NativeIcon chain={chain} className={cn("size-3.5 shrink-0", iconClassName)} />
    </span>
  );
}

/**
 * Разбивка газа по сетям одной строкой: показываются только сети с ненулевым
 * балансом. Ничего не набралось — прочерк, чтобы колонка не пустовала.
 */
export function GasTotals({
  totals,
  className,
  iconClassName,
}: {
  totals: Record<Chain, number>;
  className?: string;
  iconClassName?: string;
}) {
  const chains = (Object.keys(totals) as Chain[]).filter((c) => totals[c] > 0);
  if (chains.length === 0) return <span className={className}>—</span>;
  return (
    <span className={cn("inline-flex flex-wrap items-center justify-end gap-x-2", className)}>
      {chains.map((chain) => (
        <GasAmount key={chain} chain={chain} value={totals[chain]} iconClassName={iconClassName} />
      ))}
    </span>
  );
}
