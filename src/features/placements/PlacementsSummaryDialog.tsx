"use client";

import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PlacementIcon, PLACEMENT_ICON_META } from "@/components/PlacementIcon";
import { UsdtAmount } from "@/components/UsdtAmount";
import { GasAmount } from "@/components/GasAmount";
import { CHAINS, type Chain, type Placement, type PlacementIconId } from "@/types";

// Числовые колонки (доля, газ, сумма) выровнены по общей ширине — и в строках,
// и в плашке «Итого». min-w вместо w у сумм: обычные значения стоят в колонку,
// а аномально длинное не обрежется.

/** Строка сводки: одна платформа (иконка) или корзина записей без иконки. */
type PlatformRow = {
  icon: PlacementIconId | null; // null — записи без иконки
  amount: number; // сумма USDT
  gas: Record<Chain, number>; // газ по сетям: в одну платформу могут попасть записи разных сетей
  count: number;
};

const zeroGas = (): Record<Chain, number> =>
  Object.fromEntries(CHAINS.map((c) => [c, 0])) as Record<Chain, number>;

/** Ненулевые балансы газа — то, что реально показывается в строке. */
const gasEntries = (gas: Record<Chain, number>) =>
  CHAINS.filter((c) => gas[c] > 0).map((c) => [c, gas[c]] as const);

/** Суммы по платформам: группировка активных записей по иконке. */
function groupByIcon(placements: Placement[]) {
  const map = new Map<PlacementIconId | "__none__", PlatformRow>();
  let total = 0;
  const totalGas = zeroGas();

  for (const p of placements) {
    const key = p.icon ?? "__none__";
    const row = map.get(key) ?? { icon: p.icon, amount: 0, gas: zeroGas(), count: 0 };
    row.amount += p.amount;
    row.gas[p.chain] += p.native_amount ?? 0;
    row.count += 1;
    map.set(key, row);
    total += p.amount;
    totalGas[p.chain] += p.native_amount ?? 0;
  }

  // Крупные платформы сверху; «Без иконки» — всегда последней строкой.
  const rows = [...map.values()].sort((a, b) => {
    if (a.icon === null) return 1;
    if (b.icon === null) return -1;
    return b.amount - a.amount;
  });

  return { rows, total, totalGas, count: placements.length };
}

/**
 * Колонка газа: по строке на сеть с ненулевым балансом. Ширина фиксирована,
 * пустой блок остаётся на месте — иначе суммы съезжают по строкам.
 */
function GasColumn({ gas }: { gas: Record<Chain, number> }) {
  const entries = gasEntries(gas);
  if (entries.length === 0) return <span className="min-w-16 shrink-0" />;
  return (
    <span className="flex min-w-16 shrink-0 flex-col items-end">
      {entries.map(([chain, value]) => (
        <GasAmount
          key={chain}
          chain={chain}
          value={value}
          className="text-xs text-muted-foreground"
        />
      ))}
    </span>
  );
}

export function PlacementsSummaryDialog({
  open,
  onOpenChange,
  placements,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  placements: Placement[];
}) {
  const { rows, total, totalGas, count } = useMemo(
    () => groupByIcon(placements),
    [placements],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Сводка по свободным средствам</DialogTitle>
        </DialogHeader>

        {rows.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Нет свободных средств
          </p>
        )}

        {rows.length > 0 && (
          <div className="space-y-4 text-sm">
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
              <span className="min-w-0 flex-1 truncate font-medium">
                Итого
                {count > 1 && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                    ×{count}
                  </span>
                )}
              </span>
              {/* Пустая колонка доли — чтобы «Итого» стояло в тех же колонках, что строки ниже. */}
              <span className="w-9 shrink-0" />
              <GasColumn gas={totalGas} />
              <UsdtAmount
                value={total}
                className="min-w-20 shrink-0 justify-end font-semibold sm:min-w-24"
              />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-medium uppercase text-muted-foreground">
                По платформам
              </h3>
              <ul className="divide-y">
                {rows.map((row) => (
                  <li
                    key={row.icon ?? "__none__"}
                    className="flex items-center gap-2 px-3 py-1.5"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate">
                      {row.icon ? (
                        <>
                          <PlacementIcon icon={row.icon} className="size-4" />
                          {PLACEMENT_ICON_META[row.icon].label}
                        </>
                      ) : (
                        <span className="truncate text-muted-foreground">Без иконки</span>
                      )}
                      {row.count > 1 && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          ×{row.count}
                        </span>
                      )}
                    </span>
                    <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                      {total > 0 ? `${Math.round((row.amount / total) * 100)}%` : "—"}
                    </span>
                    <GasColumn gas={row.gas} />
                    <UsdtAmount
                      value={row.amount}
                      className="min-w-20 shrink-0 justify-end font-medium sm:min-w-24"
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
