"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ExternalLink, FileCheck, FilePlus, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ServiceIcon } from "@/components/ServiceIcon";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UsdtIcon } from "@/components/UsdtAmount";
import { DebtForm } from "@/features/debts/DebtForm";
import { usePlacementTransactions } from "@/hooks/usePlacements";
import type { Placement, Trc20Transfer } from "@/types";

// Точные суммы переводов (в отличие от целочисленных сумм в таблицах).
const amountFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function shortAddress(value: string): string {
  return value.length <= 14 ? value : `${value.slice(0, 6)}…${value.slice(-6)}`;
}

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
        ) : tx.isError ? (
          <p className="py-6 text-center text-sm text-destructive">{(tx.error as Error).message}</p>
        ) : (tx.data?.length ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Переводов USDT не найдено.
          </p>
        ) : (
          <ul className="divide-y">
            {tx.data!.map((t) => (
              <TransferRow
                key={t.tx_id}
                transfer={t}
                onCreateDebt={() => setDraft({ amount: t.amount, tx_id: t.tx_id })}
              />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransferRow({
  transfer,
  onCreateDebt,
}: {
  transfer: Trc20Transfer;
  onCreateDebt: () => void;
}) {
  const out = transfer.direction === "out";
  const counterparty = out ? transfer.to : transfer.from;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        className={
          out
            ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
            : "flex size-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"
        }
        aria-label={out ? "Исходящий" : "Входящий"}
      >
        {out ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 font-medium tabular-nums">
          {out ? "−" : "+"}
          {amountFmt.format(transfer.amount)}
          <UsdtIcon className="size-3.5 shrink-0" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{out ? "кому" : "от"}</span>
          <a
            href={`https://tronscan.org/#/address/${counterparty}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono hover:text-foreground hover:underline underline-offset-2"
            title="Открыть адрес в Tronscan"
          >
            {shortAddress(counterparty)}
          </a>
          <span aria-hidden>·</span>
          <span>{transfer.timestamp ? timeFmt.format(transfer.timestamp) : "—"}</span>
        </div>
      </div>

      <a
        href={`https://tronscan.org/#/transaction/${transfer.tx_id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground"
        title="Транзакция в Tronscan"
        aria-label="Транзакция в Tronscan"
      >
        <ExternalLink className="size-4" />
      </a>

      {out &&
        (transfer.debt ? (
          <Badge
            variant="secondary"
            className="max-w-48 shrink-0"
            title="Долг по этой транзакции уже создан"
          >
            <FileCheck aria-hidden />
            <span className="truncate">{transfer.debt.manager_name ?? "Долг"}</span>
            {transfer.debt.service && (
              <>
                <ServiceIcon service={transfer.debt.service} className="size-3.5 rounded" />
                {transfer.debt.service}
              </>
            )}
          </Badge>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onCreateDebt}
            aria-label="Создать долг"
          >
            <FilePlus className="size-4" />
            <span className="hidden sm:inline">Создать долг</span>
          </Button>
        ))}
    </li>
  );
}
