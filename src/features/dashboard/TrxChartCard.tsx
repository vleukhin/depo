"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrxAmount } from "@/components/TrxAmount";
import { formatAmount, formatDate, formatDateShort } from "@/lib/format";
import { useTrxSnapshots } from "@/hooks/useTrxSnapshots";
import { useSummary } from "@/hooks/useSummary";
import { useTrxPrice } from "@/hooks/useTrxPrice";
import type { TrxSnapshot } from "@/types";

const PERIODS = [7, 30, 90] as const;

/** Тултип точки: полная дата и сумма TRX. Recharts сам подставляет active/payload. */
function SnapshotTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: TrxSnapshot }>;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
      <p className="text-muted-foreground">{formatDate(point.date)}</p>
      <TrxAmount value={point.trx_amount} className="font-medium" />
    </div>
  );
}

/** График динамики суммарного TRX по ежедневным снимкам (trx_snapshots). */
export function TrxChartCard() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const { data } = useTrxSnapshots(days);
  const points = data ?? [];

  // Текущий суммарный TRX (перенесён из карточек статистики) + оценка в $.
  const { data: summary } = useSummary();
  const { data: trxPrice } = useTrxPrice();
  const totalTrx = summary?.total_trx ?? 0;
  const trxUsd = trxPrice?.price != null ? totalTrx * trxPrice.price : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Динамика TRX</CardTitle>
        <CardDescription>Суммарный TRX по всем размещениям на конец дня</CardDescription>
        <CardAction className="flex gap-1">
          {PERIODS.map((p) => (
            <Button
              key={p}
              size="sm"
              variant={p === days ? "secondary" : "ghost"}
              onClick={() => setDays(p)}
            >
              {p} дн
            </Button>
          ))}
        </CardAction>
      </CardHeader>
      <CardContent>
        {/* Текущий суммарный TRX — всегда виден, даже когда график ещё пуст. */}
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Всего TRX
          </p>
          <div className="flex items-baseline gap-2">
            <TrxAmount value={totalTrx} className="text-2xl font-semibold" />
            <span className="text-xs text-muted-foreground">
              {trxUsd != null ? `≈ ${formatAmount(trxUsd)} $` : "Не входит в сверку"}
            </span>
          </div>
        </div>

        {points.length < 2 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Пока мало данных — график появится после первых ежедневных снимков баланса
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {/* Ось X категориальная: дни, пропущенные кроном, соединяются линией через разрыв. */}
              <AreaChart data={points} margin={{ top: 8, right: 8 }}>
                <defs>
                  <linearGradient id="trxFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDateShort}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  tickFormatter={formatAmount}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  domain={["auto", "auto"]}
                />
                <Tooltip content={<SnapshotTooltip />} cursor={{ stroke: "var(--border)" }} />
                <Area
                  type="monotone"
                  dataKey="trx_amount"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#trxFill)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
