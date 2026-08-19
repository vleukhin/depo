"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DebtForm } from "@/features/debts/DebtForm";
import { usePlacementTransactions } from "@/hooks/usePlacements";
import type { Placement } from "@/types";
import { TransferRow } from "./TransferRow";

type Draft = { amount: number; tx_id: string };

export function TransactionsDialog({
  placement,
  open,
  onOpenChange,
}: {
  placement: Placement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const tx = usePlacementTransactions(placement.id, open);
  const transfers = tx.data?.pages.flatMap((p) => p.transfers) ?? [];

  function handleOpenChange(v: boolean) {
    if (!v) setDraft(null);
    onOpenChange(v);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {draft ? (
              <span className="inline-flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 -ml-1"
                  aria-label="Назад к транзакциям"
                  onClick={() => setDraft(null)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                Новый долг
              </span>
            ) : (
              `Транзакции — ${placement.name}`
            )}
          </DialogTitle>
        </DialogHeader>

        {draft ? (
          <DebtForm
            defaults={{ amount: draft.amount, placement_id: placement.id, tx_id: draft.tx_id }}
            onDone={() => handleOpenChange(false)}
          />
        ) : tx.isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Загрузка транзакций…</p>
        ) : tx.isError && !tx.data ? (
          <p className="py-6 text-center text-sm text-destructive">{(tx.error as Error).message}</p>
        ) : transfers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Переводов USDT не найдено.
          </p>
        ) : (
          <>
            <ul className="-mr-2 max-h-[60vh] divide-y overflow-y-auto pr-2">
              {transfers.map((t) => (
                <TransferRow
                  key={t.tx_id}
                  transfer={t}
                  onCreateDebt={() => setDraft({ amount: t.amount, tx_id: t.tx_id })}
                />
              ))}
            </ul>
            {tx.hasNextPage && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={tx.isFetchingNextPage}
                onClick={() => tx.fetchNextPage()}
              >
                {tx.isFetchingNextPage ? "Загрузка…" : "Показать ещё"}
              </Button>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
