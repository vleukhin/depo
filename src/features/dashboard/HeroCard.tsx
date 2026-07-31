"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { UsdtAmount } from "@/components/UsdtAmount";
import { useSummary } from "@/hooks/useSummary";
import { FundsDialog } from "@/features/funds/FundsDialog";

/** Герой дашборда: крупный итог депо. Статус сверки живёт в шапке (SiteHeader).
 *  Клик открывает попап состава депо. */
export function HeroCard() {
  const { data } = useSummary();
  const funds = data?.total_funds ?? 0;
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
        <CardContent>
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
        </CardContent>
      </Card>

      <FundsDialog open={fundsOpen} onOpenChange={setFundsOpen} />
    </>
  );
}
