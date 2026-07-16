"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UsdtAmount } from "@/components/UsdtAmount";
import { useSummary } from "@/hooks/useSummary";

type Segment = { name: string; value: number; color: string };

const pctFmt = new Intl.NumberFormat("ru-RU", {
  style: "percent",
  maximumFractionDigits: 1,
});

/** Тултип сегмента: название + сумма USDT. Единый язык со SnapshotTooltip графика TRX. */
function StructureTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ name?: string; value?: number }>;
}) {
  const seg = active ? payload?.[0] : undefined;
  if (!seg) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-popover">
      <p className="text-muted-foreground">{seg.name}</p>
      <UsdtAmount value={seg.value ?? 0} className="font-medium" />
    </div>
  );
}

/** Донат-диаграмма состава депо: размещено vs выдано в долг (их сумма сверяется с депо). */
export function DepoStructureCard() {
  const { data } = useSummary();
  const placed = data?.total_placements ?? 0;
  const debts = data?.total_debts ?? 0;
  const total = placed + debts;
  const empty = total === 0;

  const segments: Segment[] = [
    { name: "Размещено", value: placed, color: "var(--chart-1)" },
    { name: "Выдано в долг", value: debts, color: "var(--chart-2)" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Структура депо</CardTitle>
        <CardDescription>Размещено и долги в составе депо</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              {!empty && (
                <Tooltip
                  content={<StructureTooltip />}
                  cursor={false}
                  wrapperStyle={{ outline: "none" }}
                />
              )}
              <Pie
                data={empty ? [{ name: "Нет данных", value: 1 }] : segments}
                dataKey="value"
                nameKey="name"
                innerRadius="62%"
                outerRadius="86%"
                paddingAngle={empty ? 0 : 2}
                cornerRadius={empty ? 0 : 6}
                stroke="var(--card)"
                strokeWidth={2}
                startAngle={90}
                endAngle={-270}
                isAnimationActive={!empty}
                animationDuration={600}
                animationEasing="ease-out"
              >
                {empty ? (
                  <Cell fill="var(--muted)" />
                ) : (
                  segments.map((s) => <Cell key={s.name} fill={s.color} />)
                )}
              </Pie>
            </PieChart>
          </ResponsiveContainer>

          {/* Центральная подпись поверх отверстия доната. */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            {empty ? (
              <span className="text-sm text-muted-foreground">Нет данных</span>
            ) : (
              <div className="text-center">
                <p className="text-xs font-medium text-muted-foreground">Размещено + долги</p>
                <UsdtAmount value={total} className="text-2xl font-semibold" />
              </div>
            )}
          </div>
        </div>

        {/* Легенда: точка + название + сумма + доля. */}
        <ul className="mt-4 space-y-2">
          {segments.map((s) => (
            <li key={s.name} className="flex items-center gap-2 text-sm">
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden
              />
              <span className="text-muted-foreground">{s.name}</span>
              <span className="ml-auto flex items-center gap-2 tabular-nums">
                <UsdtAmount value={s.value} className="font-medium" />
                <span className="text-xs text-muted-foreground">
                  {pctFmt.format(total > 0 ? s.value / total : 0)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
