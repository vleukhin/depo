"use client";

import { Wallet, MapPin, HandCoins, Scale, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { UsdtAmount } from "@/components/UsdtAmount";
import { TrxAmount } from "@/components/TrxAmount";
import { useSummary } from "@/hooks/useSummary";

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
        tone === "ok" && "border-emerald-500/40 bg-emerald-500/5",
        tone === "bad" && "border-red-500/50 bg-red-500/5",
      )}
    >
      <CardContent className="flex items-start gap-3">
        <div
          className={cn(
            "rounded-md p-2",
            tone === "ok"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : tone === "bad"
                ? "bg-red-500/15 text-red-600 dark:text-red-400"
                : "bg-muted text-muted-foreground",
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-xl font-semibold tabular-nums truncate">{value}</p>
          {hint && (
            <p
              className={cn(
                "text-xs mt-0.5",
                tone === "ok"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : tone === "bad"
                    ? "text-red-600 dark:text-red-400"
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

  const funds = data?.total_funds ?? 0;
  const placed = data?.total_placements ?? 0;
  const debts = data?.total_debts ?? 0;
  const diff = data?.diff ?? 0;
  const balanced = data?.balanced ?? true;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <StatCard
        icon={<Wallet className="size-5" />}
        label="Всего в депо"
        value={<UsdtAmount value={funds} />}
      />
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
      <StatCard
        icon={<Coins className="size-5" />}
        label="Всего TRX"
        value={<TrxAmount value={data?.total_trx ?? 0} />}
        hint="Не входит в сверку"
      />
    </div>
  );
}
