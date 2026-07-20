"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, MoreHorizontal, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { formatDate } from "@/lib/format";
import { UsdtAmount } from "@/components/UsdtAmount";
import { ServiceIcon } from "@/components/ServiceIcon";
import { TxLink } from "@/components/TxLink";
import { useDebts, useDeleteDebt, useReorderDebts } from "@/hooks/useDebts";
import type { Debt } from "@/types";
import { DebtForm } from "./DebtForm";
import { ManagersDialog } from "@/features/managers/ManagersDialog";

const DELETE_DESC = "Долг переместится в архив. Восстановить можно на странице архива.";

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
  const [deleting, setDeleting] = useState<Debt | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setOpen(true);
  }
  function openEdit(debt: Debt) {
    setEditing(debt);
    setOpen(true);
  }

  async function confirmDelete() {
    const target = deleting;
    if (!target) return;
    try {
      await del.mutateAsync(target.id);
      toast.success("Запись удалена");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <SectionCard
      id="debts"
      title="Долги"
      description="Кто и сколько взял из депо"
      onAdd={openCreate}
      actions={
        <>
          <Button size="sm" variant="outline" asChild aria-label="Архив">
            <Link href="/archive/debts">
              <Archive className="size-4" />
              <span className="hidden md:inline">Архив</span>
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setManagersOpen(true)}
            aria-label="Менеджеры"
          >
            <Users className="size-4" />
            <span className="hidden md:inline">Менеджеры</span>
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
                    <span className="inline-flex items-center justify-end gap-1.5">
                      <UsdtAmount value={debt.amount} />
                      <TxLink txId={debt.tx_id} />
                    </span>
                  </TableCell>
                  <TableCell>
                    {debt.service ? (
                      <Badge variant="secondary" className="gap-1.5 pl-1">
                        <ServiceIcon service={debt.service} className="size-4" />
                        {debt.service}
                      </Badge>
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
                      description={DELETE_DESC}
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

      {/* Мобильный компактный список (2 строки на позицию): отдельный DndContext. */}
      <SortableRows ids={debts.map((d) => d.id)} onReorder={(ids) => reorder.mutate(ids)}>
        <ul className="space-y-2 md:hidden">
          {debts.map((debt) => (
            <SortableCard key={debt.id} id={debt.id}>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(debt)}
                  aria-label={`Изменить долг: ${debt.manager_name ?? ""}`}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 py-1 text-left outline-none"
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {debt.manager_name ?? "—"}
                    </span>
                    <UsdtAmount value={debt.amount} className="shrink-0 text-sm font-semibold" />
                  </div>
                  <span className="flex w-full min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="shrink-0 tabular-nums">{formatDate(debt.date)}</span>
                    <span aria-hidden>·</span>
                    {debt.service ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <ServiceIcon service={debt.service} className="size-3.5 rounded" />
                        {debt.service}
                      </span>
                    ) : (
                      <span className="shrink-0">—</span>
                    )}
                    <span aria-hidden>·</span>
                    <span className="min-w-0 truncate">{sourceLabel(debt)}</span>
                  </span>
                </button>
                {debt.tx_id && (
                  <TxLink
                    txId={debt.tx_id}
                    className="flex size-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground"
                  />
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0"
                      aria-label="Действия"
                    >
                      <MoreHorizontal className="size-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onSelect={() => openEdit(debt)}>
                      <Pencil />
                      Изменить
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(debt)}>
                      <Trash2 />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SortableCard>
          ))}
          {!isLoading && debts.length === 0 && (
            <li className="rounded-lg ring-1 ring-foreground/10 bg-card shadow-card px-3 py-4 text-center text-sm text-muted-foreground">
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

      <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(undefined)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
            <AlertDialogDescription>{DELETE_DESC}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ManagersDialog open={managersOpen} onOpenChange={setManagersOpen} />
    </SectionCard>
  );
}
