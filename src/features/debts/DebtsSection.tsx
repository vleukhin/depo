"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionCard } from "@/components/SectionCard";
import { DeleteButton } from "@/components/DeleteButton";
import { SortableCard, SortableRow, SortableRows } from "@/components/SortableRows";
import { formatDate, formatUsdt } from "@/lib/format";
import { UsdtAmount } from "@/components/UsdtAmount";
import { useDebts, useDeleteDebt, useReorderDebts } from "@/hooks/useDebts";
import type { Debt } from "@/types";
import { DebtForm } from "./DebtForm";
import { ManagersDialog } from "@/features/managers/ManagersDialog";

function sourceLabel(debt: Debt): string {
  if (debt.placement_name) return debt.placement_name;
  if (debt.source_text) return debt.source_text;
  return "—";
}

export function DebtsSection() {
  const { data: debts = [], isLoading } = useDebts();
  const del = useDeleteDebt();
  const reorder = useReorderDebts();
  const [open, setOpen] = useState(false);
  const [managersOpen, setManagersOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setOpen(true);
  }
  function openEdit(debt: Debt) {
    setEditing(debt);
    setOpen(true);
  }

  return (
    <SectionCard
      id="debts"
      title="Долги"
      description="Кто и сколько взял из депо"
      onAdd={openCreate}
      actions={
        <>
          <Button size="sm" variant="outline" asChild>
            <Link href="/archive/debts">
              <Archive className="size-4" />
              Архив
            </Link>
          </Button>
          <Button size="sm" variant="outline" onClick={() => setManagersOpen(true)}>
            <Users className="size-4" />
            Менеджеры
          </Button>
        </>
      }
    >
      <div className="hidden overflow-x-auto md:block">
        <SortableRows ids={debts.map((d) => d.id)} onReorder={(ids) => reorder.mutate(ids)}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Менеджер</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Сервис</TableHead>
                <TableHead>Откуда взял</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.map((debt) => (
                <SortableRow key={debt.id} id={debt.id}>
                  <TableCell className="font-medium">{debt.manager_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatDate(debt.date)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUsdt(debt.amount)}
                  </TableCell>
                  <TableCell>
                    {debt.service ? (
                      <Badge variant="secondary">{debt.service}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{sourceLabel(debt)}</TableCell>
                  <TableCell className="text-muted-foreground max-w-48 truncate">
                    {debt.comment ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Изменить"
                      onClick={() => openEdit(debt)}
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </Button>
                    <DeleteButton
                      description="Долг переместится в архив. Восстановить можно на странице архива."
                      onConfirm={() => del.mutateAsync(debt.id)}
                    />
                  </TableCell>
                </SortableRow>
              ))}
              {!isLoading && debts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Пока нет записей
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SortableRows>
      </div>

      {/* Мобильный список карточек (§7): отдельный DndContext с теми же id. */}
      <SortableRows ids={debts.map((d) => d.id)} onReorder={(ids) => reorder.mutate(ids)}>
        <ul className="space-y-2 md:hidden">
          {debts.map((debt) => (
            <SortableCard key={debt.id} id={debt.id}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{debt.manager_name ?? "—"}</span>
                <span className="text-base font-semibold tabular-nums">
                  {formatUsdt(debt.amount)}
                </span>
              </div>
              <dl className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-baseline justify-between gap-3">
                  <dt>Дата</dt>
                  <dd className="tabular-nums text-foreground">{formatDate(debt.date)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Сервис</dt>
                  <dd>
                    {debt.service ? <Badge variant="secondary">{debt.service}</Badge> : "—"}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt>Откуда взял</dt>
                  <dd className="text-right text-foreground">{sourceLabel(debt)}</dd>
                </div>
                {debt.comment && (
                  <div>
                    <dt>Комментарий</dt>
                    <dd className="mt-0.5 text-foreground">{debt.comment}</dd>
                  </div>
                )}
              </dl>
              <div className="mt-2 flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  aria-label="Изменить"
                  onClick={() => openEdit(debt)}
                >
                  <Pencil className="size-4 text-muted-foreground" />
                </Button>
                <DeleteButton
                  className="size-11"
                  description="Долг переместится в архив. Восстановить можно на странице архива."
                  onConfirm={() => del.mutateAsync(debt.id)}
                />
              </div>
            </SortableCard>
          ))}
          {!isLoading && debts.length === 0 && (
            <li className="rounded-lg ring-1 ring-foreground/10 bg-card shadow-card p-3 text-center text-sm text-muted-foreground">
              Пока нет записей
            </li>
          )}
        </ul>
      </SortableRows>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Изменить долг" : "Новый долг"}</DialogTitle>
          </DialogHeader>
          <DebtForm debt={editing} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <ManagersDialog open={managersOpen} onOpenChange={setManagersOpen} />
    </SectionCard>
  );
}
