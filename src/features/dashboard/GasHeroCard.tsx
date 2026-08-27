"use client";

import { Card, CardContent } from "@/components/ui/card";
import { GasAmount } from "@/components/GasAmount";
import { formatAmount } from "@/lib/format";
import { useSummary } from "@/hooks/useSummary";
import { useNativePrices } from "@/hooks/useNativePrices";
import { CHAINS, type Chain } from "@/types";

/**
 * Компаньон героя: газ (нативные монеты) по всем записям свободных средств.
 * Крупно — общая оценка в $, под ней разбивка по сетям. В сверку не входит.
 */
export function GasHeroCard() {
  const { data: summary } = useSummary();
  const { data: prices } = useNativePrices();
  const totals = summary?.total_native;

  const chains: Chain[] = CHAINS.filter((c) => (totals?.[c] ?? 0) > 0);
  // Оценка в долларах есть только для сетей с известным курсом; если курс не
  // пришёл ни по одной из них — показываем прочерк, а не заниженную сумму.
  const priced = chains.filter((c) => prices?.[c] != null);
  const totalUsd = priced.reduce((sum, c) => sum + (totals?.[c] ?? 0) * (prices?.[c] ?? 0), 0);
  const partial = priced.length > 0 && priced.length < chains.length;

  return (
    <Card className="relative h-full overflow-hidden bg-[linear-gradient(180deg,var(--muted)/0.5,transparent_45%)] shadow-card">
      <CardContent className="flex h-full flex-col justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">Газ</p>
        <div className="space-y-1">
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            {priced.length > 0 ? `≈ ${formatAmount(totalUsd)} $` : "—"}
          </p>
          {chains.length > 0 ? (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {chains.map((chain) => (
                <GasAmount key={chain} chain={chain} value={totals?.[chain] ?? 0} />
              ))}
              {partial && <span>курс части сетей недоступен</span>}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">Не входит в сверку</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
