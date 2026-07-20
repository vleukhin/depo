"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Archive,
  Copy,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { AddressCell } from "@/components/AddressCell";
import { DeleteButton } from "@/components/DeleteButton";
import { SortableCard, SortableRow, SortableRows } from "@/components/SortableRows";
import { UsdtAmount } from "@/components/UsdtAmount";
import { TrxAmount } from "@/components/TrxAmount";
import { PlacementIcon } from "@/components/PlacementIcon";
import { isTronAddress } from "@/lib/tron";
import {
  useCheckBalances,
  useDeletePlacement,
  usePlacements,
  useReorderPlacements,
} from "@/hooks/usePlacements";
import type { Placement } from "@/types";
import { ACCOUNT_LABELS, PlacementForm } from "./PlacementForm";
import { TrxTopUpDialog } from "./TrxTopUpDialog";
import { TransactionsDialog } from "./TransactionsDialog";

const DELETE_DESC =
  "Размещение переместится в архив. Пока оно там, у связанных долгов источник не отображается. Восстановить можно на странице архива.";

/** Короткое место размещения для компактной мобильной строки. */
function placementLocation(p: Placement): string {
  if (p.kind === "exchange" && p.exchange && p.exchange_account) {
    return `${p.exchange} · ${ACCOUNT_LABELS[p.exchange_account]}`;
  }
  if (p.address) return `${p.address.slice(0, 6)}…${p.address.slice(-4)}`;
  return "—";
}

/** Копирование адреса в буфер (та же логика/тексты, что в CopyButton). */
async function copyAddress(address: string) {
  try {
    await navigator.clipboard.writeText(address);
    toast.success("Адрес скопирован");
  } catch {
    toast.error("Не удалось скопировать");
  }
}

export function PlacementsSection() {
  const { data: placements = [], isLoading } = usePlacements();
  const del = useDeletePlacement();
  const reorder = useReorderPlacements();
  const check = useCheckBalances();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Placement | undefined>(undefined);
  const [topUp, setTopUp] = useState<Placement | undefined>(undefined);
  const [txFor, setTxFor] = useState<Placement | undefined>(undefined);
  const [deleting, setDeleting] = useState<Placement | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setOpen(true);
  }
  function openEdit(placement: Placement) {
    setEditing(placement);
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

  async function checkBalances() {
    try {
      const res = await check.mutateAsync();
      if (res.failed.length > 0) {
        toast.warning(
          `Проверено: ${res.checked}, ошибок: ${res.failed.length} (${res.failed
            .map((f) => f.name)
            .join(", ")})`,
        );
      } else if (res.checked === 0) {
        toast.info("Нет строк с TRON-адресами или биржевыми счетами для проверки");
      } else {
        toast.success(`Балансы обновлены (строк: ${res.checked})`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <SectionCard
      id="placements"
      title="Размещение"
      description="Где средства находятся сейчас"
      onAdd={openCreate}
      actions={
        <>
          <Button size="sm" variant="outline" asChild aria-label="Архив">
            <Link href="/archive/placements">
              <Archive className="size-4" />
              <span className="hidden md:inline">Архив</span>
            </Link>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={checkBalances}
            disabled={check.isPending}
            aria-label="Проверить балансы"
          >
            <RefreshCw className={check.isPending ? "size-4 animate-spin" : "size-4"} />
            <span className="hidden md:inline">
              {check.isPending ? "Проверка…" : "Проверить балансы"}
            </span>
          </Button>
        </>
      }
    >
      <div className="hidden overflow-x-auto md:block">
        <SortableRows
          ids={placements.map((p) => p.id)}
          onReorder={(ids) => reorder.mutate(ids)}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Название</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-right">TRX</TableHead>
                <TableHead>Адрес / счёт</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {placements.map((p) => (
                <SortableRow key={p.id} id={p.id}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {p.icon && <PlacementIcon icon={p.icon} className="size-3.5" />}
                      {p.name}
                    </span>
                  </TableCell>
                  <TableCell
                    className="text-right"
                    title={
                      p.chain_checked_at
                        ? `Обновлено автоматически: ${p.chain_checked_at} UTC`
                        : undefined
                    }
                  >
                    <UsdtAmount value={p.amount} />
                  </TableCell>
                  <TableCell
                    className="text-right tabular-nums text-muted-foreground"
                    title={
                      p.chain_checked_at
                        ? `Обновлено автоматически: ${p.chain_checked_at} UTC`
                        : undefined
                    }
                  >
                    <span className="inline-flex items-center justify-end gap-1">
                      {p.trx_amount != null ? <TrxAmount value={p.trx_amount} /> : "—"}
                      {p.kind === "wallet" && isTronAddress(p.address) ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          aria-label="Пополнить TRX"
                          title="Пополнить TRX с биржи"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTopUp(p);
                          }}
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      ) : (
                        // Заглушка на месте кнопки «+», чтобы числа не съезжали
                        // в строках без неё (биржи, кошельки без адреса).
                        <span aria-hidden className="size-6 shrink-0" />
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {p.kind === "exchange" && p.exchange && p.exchange_account ? (
                      <span className="font-sans">
                        {p.exchange} · {ACCOUNT_LABELS[p.exchange_account]}
                      </span>
                    ) : (
                      <AddressCell address={p.address} />
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-48 truncate">
                    {p.comment ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.kind === "wallet" && isTronAddress(p.address) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Транзакции"
                        title="Транзакции кошелька"
                        onClick={(e) => {
                          e.stopPropagation();
                          setTxFor(p);
                        }}
                      >
                        <History className="size-4 text-muted-foreground" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Изменить"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </Button>
                    <DeleteButton
                      description={DELETE_DESC}
                      onConfirm={() => del.mutateAsync(p.id)}
                    />
                  </TableCell>
                </SortableRow>
              ))}
              {!isLoading && placements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Пока нет записей
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SortableRows>
      </div>

      {/* Мобильный компактный список (2 строки на позицию): отдельный DndContext. */}
      <SortableRows
        ids={placements.map((p) => p.id)}
        onReorder={(ids) => reorder.mutate(ids)}
      >
        <ul className="space-y-2 md:hidden">
          {placements.map((p) => (
            <SortableCard key={p.id} id={p.id}>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => openEdit(p)}
                  aria-label={`Изменить: ${p.name}`}
                  className="flex min-w-0 flex-1 flex-col gap-0.5 py-1 text-left outline-none"
                >
                  <div className="flex w-full items-center gap-2">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5">
                      {p.icon && <PlacementIcon icon={p.icon} className="size-3.5 shrink-0" />}
                      <span className="min-w-0 truncate font-medium">{p.name}</span>
                    </span>
                    <UsdtAmount value={p.amount} className="shrink-0 text-sm font-semibold" />
                  </div>
                  <span className="flex w-full min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">{placementLocation(p)}</span>
                    {p.trx_amount != null && (
                      <span className="flex shrink-0 items-center gap-1">
                        <span aria-hidden>·</span>
                        <TrxAmount value={p.trx_amount} iconClassName="size-3" />
                      </span>
                    )}
                  </span>
                </button>
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
                    <DropdownMenuItem onSelect={() => openEdit(p)}>
                      <Pencil />
                      Изменить
                    </DropdownMenuItem>
                    {p.address && (
                      <DropdownMenuItem onSelect={() => copyAddress(p.address!)}>
                        <Copy />
                        Копировать адрес
                      </DropdownMenuItem>
                    )}
                    {p.kind === "wallet" && isTronAddress(p.address) && (
                      <>
                        <DropdownMenuItem onSelect={() => setTxFor(p)}>
                          <History />
                          Транзакции
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setTopUp(p)}>
                          <Plus />
                          Пополнить TRX
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(p)}>
                      <Trash2 />
                      Удалить
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </SortableCard>
          ))}
          {!isLoading && placements.length === 0 && (
            <li className="rounded-lg ring-1 ring-foreground/10 bg-card shadow-card px-3 py-4 text-center text-sm text-muted-foreground">
              Пока нет записей
            </li>
          )}
        </ul>
      </SortableRows>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Изменить размещение" : "Новое размещение"}</DialogTitle>
          </DialogHeader>
          <PlacementForm placement={editing} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(undefined)}
      >
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

      {topUp && (
        <TrxTopUpDialog
          key={topUp.id}
          placement={topUp}
          open
          onOpenChange={(v) => !v && setTopUp(undefined)}
        />
      )}

      {txFor && (
        <TransactionsDialog
          key={txFor.id}
          placement={txFor}
          open
          onOpenChange={(v) => !v && setTxFor(undefined)}
        />
      )}
    </SectionCard>
  );
}
