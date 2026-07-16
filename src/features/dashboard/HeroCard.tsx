"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UsdtAmount } from "@/components/UsdtAmount";
import { cn } from "@/lib/utils";
import { useSummary } from "@/hooks/useSummary";
import { FundsDialog } from "@/features/funds/FundsDialog";

/** Статус сверки как капсула-пилюля. Использует семантические токены success/destructive. */
function ReconciliationPill({ balanced, diff }: { balanced: boolean; diff: number }) {
  const negative = !balanced && diff < 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1 text-xs font-medium ring-1 sm:self-auto",
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

/** Герой дашборда: крупный итог депо и статус сверки. Клик открывает попап состава депо. */
export function HeroCard() {
  const { data } = useSummary();
  const funds = data?.total_funds ?? 0;
  const diff = data?.diff ?? 0;
  const balanced = data?.balanced ?? true;
  const [fundsOpen, setFundsOpen] = useState(false);

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        aria-label="Изменить состав депо"
        title="Нажмите, чтобы изменить состав депо"
        onClick={() => setFundsOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFundsOpen(true);
          }
        }}
        className="group relative h-full cursor-pointer overflow-hidden bg-[linear-gradient(180deg,oklch(0.55_0.23_285/0.06),transparent_45%)] shadow-card outline-none transition-shadow hover:shadow-raised focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              Всего в депо
              <Pencil className="size-3.5 opacity-40 transition-opacity group-hover:opacity-80" />
            </p>
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

      <FundsDialog open={fundsOpen} onOpenChange={setFundsOpen} />
    </>
  );
}
