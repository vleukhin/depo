"use client";

import { Card, CardContent } from "@/components/ui/card";
import { UsdtAmount } from "@/components/UsdtAmount";
import { cn } from "@/lib/utils";
import { useSummary } from "@/hooks/useSummary";

/** Статус сверки как капсула-пилюля. Использует семантические токены success/destructive. */
function ReconciliationPill({ balanced, diff }: { balanced: boolean; diff: number }) {
  const negative = !balanced && diff < 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ring-1",
        negative
          ? "bg-destructive/10 text-destructive ring-destructive/20"
          : "bg-success/10 text-success ring-success/20",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {balanced ? (
        "Сходится"
      ) : (
        <>
          {diff > 0 ? "Избыток" : "Недостача"}
          <UsdtAmount value={diff} signed />
        </>
      )}
    </span>
  );
}

/** Герой дашборда: крупный итог депо и статус сверки. */
export function HeroCard() {
  const { data } = useSummary();
  const funds = data?.total_funds ?? 0;
  const diff = data?.diff ?? 0;
  const balanced = data?.balanced ?? true;

  return (
    <Card className="relative overflow-hidden bg-[linear-gradient(180deg,oklch(0.55_0.23_285/0.06),transparent_45%)] shadow-card">
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">Всего в депо</p>
          <div className="flex items-center gap-2">
            <UsdtAmount
              value={funds}
              className="text-5xl font-semibold tracking-tight sm:text-6xl"
              iconClassName="size-8"
            />
          </div>
        </div>
        <ReconciliationPill balanced={balanced} diff={diff} />
      </CardContent>
    </Card>
  );
}
