"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
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
import { SortableRow, SortableRows } from "@/components/SortableRows";
import { formatDate, formatUsdt } from "@/lib/format";
import { useDebts, useDeleteDebt, useReorderDebts } from "@/hooks/useDebts";
import type { Debt } from "@/types";
import { DebtForm } from "./DebtForm";

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
    >
      <div className="overflow-x-auto">
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
                  <TableCell className="font-medium">{debt.manager}</TableCell>
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
                    <DeleteButton onConfirm={() => del.mutateAsync(debt.id)} />
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Изменить долг" : "Новый долг"}</DialogTitle>
          </DialogHeader>
          <DebtForm debt={editing} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
