"use client";

import { MapPin, HandCoins, Scale, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UsdtAmount } from "@/components/UsdtAmount";
import { TrxAmount } from "@/components/TrxAmount";
import { formatAmount } from "@/lib/format";
import { useSummary } from "@/hooks/useSummary";
import { useTrxPrice } from "@/hooks/useTrxPrice";

function StatCard({
  icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "ok" | "bad";
}) {
  return (
    <Card
      className={cn(
        "transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-raised motion-reduce:transform-none motion-reduce:transition-none",
        tone === "ok" && "border-success/40 bg-success/5",
        tone === "bad" && "border-destructive/50 bg-destructive/5",
      )}
    >
      <CardContent className="flex items-start gap-3">
        <div
          className={cn(
            "rounded-md p-2",
            tone === "ok"
              ? "bg-success/15 text-success"
              : tone === "bad"
                ? "bg-destructive/15 text-destructive"
                : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tabular-nums truncate">{value}</p>
          {hint && (
            <p
              className={cn(
                "text-xs mt-0.5",
                tone === "ok"
                  ? "text-success"
                  : tone === "bad"
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {hint}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardCards() {
  const { data } = useSummary();
  const { data: trxPrice } = useTrxPrice();

  const placed = data?.total_placements ?? 0;
  const debts = data?.total_debts ?? 0;
  const diff = data?.diff ?? 0;
  const balanced = data?.balanced ?? true;
  const totalTrx = data?.total_trx ?? 0;
  // Примерная оценка TRX в долларах (курс TRX/USDT ≈ USD); null — курс недоступен.
  const trxUsd = trxPrice?.price != null ? totalTrx * trxPrice.price : null;

  return (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<MapPin className="size-5" />}
        label="Размещено"
        value={<UsdtAmount value={placed} />}
      />
      <StatCard
        icon={<HandCoins className="size-5" />}
        label="Выдано в долг"
        value={<UsdtAmount value={debts} />}
      />
      <StatCard
        icon={<Coins className="size-5" />}
        label="Всего TRX"
        value={<TrxAmount value={totalTrx} />}
        hint={trxUsd != null ? `≈ ${formatAmount(trxUsd)} $` : "Не входит в сверку"}
      />
      <StatCard
        icon={<Scale className="size-5" />}
        label="Сверка (размещено + долги)"
        value={balanced ? "Сходится" : <UsdtAmount value={diff} signed />}
        hint={
          balanced
            ? "Размещено + долги = депо"
            : diff > 0
              ? "Избыток"
              : "Недостача"
        }
        tone={diff >= 0 ? "ok" : "bad"}
      />
    </div>
  );
}
