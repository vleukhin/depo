"use client";

import { UsdtAmount } from "@/components/UsdtAmount";
import { cn } from "@/lib/utils";

/** Статус сверки как капсула-пилюля. Использует семантические токены success/destructive.
 *  Живая сверка висит в шапке (SiteHeader), страницы снимков показывают той же капсулой
 *  сверку на момент снимка. */
export function ReconciliationPill({ balanced, diff }: { balanced: boolean; diff: number }) {
  // Суммы отображаются округлёнными до целых, поэтому расхождение меньше 0.5
  // визуально неотличимо от нуля — показываем «Сходится», а не «Недостача −0».
  const rounded = Math.round(diff);
  const shown = balanced || rounded === 0;
  const negative = !shown && rounded < 0;
  return (
    <span
      className={cn(
        // whitespace-nowrap: в шапке фиксированной высоты капсула не должна переноситься.
        "inline-flex items-center gap-1.5 self-start whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ring-1 sm:self-auto",
        negative
          ? "bg-destructive/10 text-destructive ring-destructive/20"
          : "bg-success/10 text-success ring-success/20",
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {shown ? (
        "Сходится"
      ) : (
        <>
          {rounded > 0 ? "Избыток" : "Недостача"}
          <UsdtAmount value={diff} signed />
        </>
      )}
    </span>
  );
}
