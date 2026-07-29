"use client";

import { useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { ru } from "react-day-picker/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ServiceIcon } from "@/components/ServiceIcon";
import { UsdtAmount } from "@/components/UsdtAmount";
import { formatDate, parseYmd, toYmd } from "@/lib/format";
import { useDebtsSummary } from "@/hooks/useDebtsSummary";
import type { DebtsSummaryRow, Service } from "@/types";

// Дни с активными долгами помечаются точкой под числом (цвет — текущий цвет текста дня).
const HAS_DEBTS_CLASS =
  "[&>button]:relative [&>button]:after:absolute [&>button]:after:bottom-0.5 " +
  "[&>button]:after:left-1/2 [&>button]:after:-translate-x-1/2 [&>button]:after:size-1 " +
  "[&>button]:after:rounded-full [&>button]:after:bg-current [&>button]:after:content-['']";

function todayRange(): DateRange {
  const now = new Date();
  return { from: now, to: now };
}

/** Пресеты периода: диапазон пересчитывается от текущего дня в момент клика. */
const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: "Сегодня", range: todayRange },
  {
    label: "Вчера",
    range: () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return { from: d, to: d };
    },
  },
  {
    label: "Неделя",
    range: () => {
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { from, to: new Date() };
    },
  },
  {
    label: "Месяц",
    range: () => {
      const from = new Date();
      from.setDate(from.getDate() - 29);
      return { from, to: new Date() };
    },
  },
];

function SummaryRows({
  rows,
  fallbackName,
  showServiceIcon,
}: {
  rows: DebtsSummaryRow[];
  fallbackName: string;
  showServiceIcon?: boolean;
}) {
  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.name ?? "__none__"} className="flex items-center gap-2 py-1.5">
          <span className="min-w-0 flex-1 truncate">
            {row.name && showServiceIcon ? (
              <Badge variant="secondary" className="gap-1.5 pl-1">
                <ServiceIcon service={row.name as Service} className="size-4" />
                {row.name}
              </Badge>
            ) : (
              <span className={row.name ? "" : "text-muted-foreground"}>
                {row.name ?? fallbackName}
              </span>
            )}
          </span>
          {row.count > 1 && (
            <span className="shrink-0 text-xs text-muted-foreground">×{row.count}</span>
          )}
          <UsdtAmount value={row.amount} className="shrink-0 font-medium" />
        </li>
      ))}
    </ul>
  );
}

export function DebtsSummaryDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [range, setRange] = useState<DateRange>(todayRange);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const from = toYmd(range.from ?? new Date());
  const to = toYmd(range.to ?? range.from ?? new Date());
  const { data, isLoading, isError, error } = useDebtsSummary(from, to, open);

  // Дни с активными долгами — для подсветки в календаре.
  const debtDays = useMemo(() => (data?.dates ?? []).map(parseYmd), [data?.dates]);

  const periodLabel = from === to ? formatDate(from) : `${formatDate(from)} — ${formatDate(to)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Сводка по долгам</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5">
          <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="font-normal">
                <CalendarIcon className="size-4 text-muted-foreground" />
                {periodLabel}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={range}
                // Пустой выбор (повторный клик по началу диапазона) не сбрасывает период.
                onSelect={(r) => {
                  if (r?.from) setRange(r);
                }}
                defaultMonth={range.from}
                modifiers={{ hasDebts: debtDays }}
                modifiersClassNames={{ hasDebts: HAS_DEBTS_CLASS }}
                locale={ru}
                autoFocus
              />
            </PopoverContent>
          </Popover>
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setRange(preset.range())}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        {isError && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}

        {data && data.count === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Нет долгов за выбранный период
          </p>
        )}

        {data && data.count > 0 && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
              <span className="font-medium">
                Итого
                {data.count > 1 && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    ×{data.count}
                  </span>
                )}
              </span>
              <UsdtAmount value={data.total} className="font-semibold" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">
                По менеджерам
              </h3>
              <SummaryRows rows={data.by_manager} fallbackName="Без менеджера" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">
                По сервисам
              </h3>
              <SummaryRows rows={data.by_service} fallbackName="Без сервиса" showServiceIcon />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
