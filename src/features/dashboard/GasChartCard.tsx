"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
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
import { GasAmount, formatGas } from "@/components/GasAmount";
import { CHAIN_META } from "@/lib/chains";
import { formatDate, formatDateShort } from "@/lib/format";
import { useCollapsed } from "@/hooks/useCollapsed";
import { useNativeSnapshots } from "@/hooks/useNativeSnapshots";
import { cn } from "@/lib/utils";
import { CHAINS, type Chain, type NativeSnapshot } from "@/types";

const PERIODS = [7, 30, 90] as const;

/** Тултип точки: полная дата и сумма газа. Recharts сам подставляет active/payload. */
function SnapshotTooltip({
  active,
  payload,
  chain,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: NativeSnapshot }>;
  chain: Chain;
}) {
  const point = active ? payload?.[0]?.payload : undefined;
  if (!point) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-sm">
      <p className="text-muted-foreground">{formatDate(point.date)}</p>
      <GasAmount chain={chain} value={point.amount} className="font-medium" />
    </div>
  );
}

/**
 * График динамики суммарного газа по ежедневным снимкам (native_snapshots).
 * Сети переключаются, а не рисуются вместе: тысячи TRX и сотые доли ETH
 * на общей оси Y нечитаемы.
 */
export function GasChartCard() {
  const [collapsed, toggle] = useCollapsed("gas-chart", true);
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [chain, setChain] = useState<Chain>("tron");
  const { data } = useNativeSnapshots(chain, days);
  const points = data ?? [];

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={toggle}>
        <CardTitle className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              collapsed && "-rotate-90",
            )}
          />
          Динамика газа
        </CardTitle>
        <CardDescription className="hidden pl-6 md:block">
          Суммарный {CHAIN_META[chain].native} на конец дня
        </CardDescription>
        {/* Переключатели нужны только в развёрнутой карточке; клик по ним не схлопывает её. */}
        {!collapsed && (
          <CardAction className="flex flex-wrap justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {CHAINS.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={c === chain ? "secondary" : "ghost"}
                onClick={() => setChain(c)}
              >
                {CHAIN_META[c].native}
              </Button>
            ))}
            <span aria-hidden className="w-2" />
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
        )}
      </CardHeader>
      {!collapsed && (
        <CardContent>
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
                    <linearGradient id="gasFill" x1="0" y1="0" x2="0" y2="1">
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
                    tickFormatter={formatGas}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    content={<SnapshotTooltip chain={chain} />}
                    cursor={{ stroke: "var(--border)" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="amount"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#gasFill)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
