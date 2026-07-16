"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrxAmount } from "@/components/TrxAmount";
import { formatAmount } from "@/lib/format";
import { useSummary } from "@/hooks/useSummary";
import { useTrxPrice } from "@/hooks/useTrxPrice";

/** Компаньон героя: суммарный TRX по всем размещениям и его оценка в $. Не входит в сверку. */
export function TrxHeroCard() {
  const { data: summary } = useSummary();
  const { data: trxPrice } = useTrxPrice();
  const totalTrx = summary?.total_trx ?? 0;
  const trxUsd = trxPrice?.price != null ? totalTrx * trxPrice.price : null;

  return (
    <Card className="relative h-full overflow-hidden bg-[linear-gradient(180deg,oklch(0.63_0.24_25/0.06),transparent_45%)] shadow-card">
      <CardContent className="flex h-full flex-col justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">Всего TRX</p>
        <div className="space-y-1">
          <TrxAmount
            value={totalTrx}
            className="text-4xl font-semibold tracking-tight"
            iconClassName="size-6"
          />
          <p className="text-xs text-muted-foreground">
            {trxUsd != null ? `≈ ${formatAmount(trxUsd)} $` : "Не входит в сверку"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
