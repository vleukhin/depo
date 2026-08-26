"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  BarChart3,
  Copy,
  History,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Tags,
  Trash2,
  X,
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { CompactTagList, TagBadge, TagToggle } from "@/components/TagBadge";
import { isTronAddress } from "@/lib/tron";
import { cn } from "@/lib/utils";
import {
  useCheckBalances,
  useDeletePlacement,
  usePlacements,
  useReorderPlacements,
} from "@/hooks/usePlacements";
import { useTags } from "@/hooks/useTags";
import { useStoredBoolean } from "@/hooks/useStoredBoolean";
import type { Placement } from "@/types";
import { ACCOUNT_LABELS, PlacementForm } from "./PlacementForm";
import { TrxTopUpDialog } from "./TrxTopUpDialog";
import { TransactionsDialog } from "./TransactionsDialog";
import { PlacementsSummaryDialog } from "./PlacementsSummaryDialog";
import { DayTransactionsDialog } from "./DayTransactionsDialog";

const DELETE_DESC =
  "Запись переместится в архив. Пока она там, у связанных долгов источник не отображается. Восстановить можно на странице архива.";

/** Короткое место хранения средств для компактной мобильной строки. */
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
  const { data: tags = [] } = useTags();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Placement | undefined>(undefined);
  const [topUp, setTopUp] = useState<Placement | undefined>(undefined);
  const [txFor, setTxFor] = useState<Placement | undefined>(undefined);
  const [deleting, setDeleting] = useState<Placement | undefined>(undefined);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [dayTxOpen, setDayTxOpen] = useState(false);
  const [filterTags, setFilterTags] = useState<number[]>([]);
  const [compactTags, toggleCompactTags] = useStoredBoolean(
    "depo:placements:compact-tags",
  );

  // ИЛИ: запись подходит, если у неё есть хотя бы один из выбранных тегов.
  const visible = useMemo(
    () =>
      filterTags.length === 0
        ? placements
        : placements.filter((p) => p.tags.some((t) => filterTags.includes(t.id))),
    [placements, filterTags],
  );
  const filtering = filterTags.length > 0;

  function toggleFilterTag(id: number) {
    setFilterTags((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

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
      title="Свободные средства"
      description="Где средства находятся сейчас"
      onAdd={openCreate}
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setDayTxOpen(true)}
            aria-label="Транзакции"
          >
            <History className="size-4" />
            <span className="hidden md:inline">Транзакции</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSummaryOpen(true)}
            aria-label="Сводка"
          >
            <BarChart3 className="size-4" />
            <span className="hidden md:inline">Сводка</span>
          </Button>
          <Button size="sm" variant="outline" asChild aria-label="Архив">
            <Link href="/archive/placements">
              <Archive className="size-4" />
              <span className="hidden md:inline">Архив</span>
            </Link>
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant={filtering ? "default" : "outline"}
                aria-label="Фильтр по тегам"
              >
                <Tags className="size-4" />
                <span className="hidden md:inline">Теги</span>
                {filtering && <span className="tabular-nums">{filterTags.length}</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-3">
              <div className="flex items-center justify-between gap-3 border-b pb-3">
                <span className="text-sm">Компактный вид</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={compactTags}
                  aria-label="Компактный вид тегов"
                  onClick={toggleCompactTags}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                    compactTags ? "bg-primary" : "bg-input",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-4 rounded-full bg-background shadow-sm transition-transform",
                      compactTags && "translate-x-4",
                    )}
                  />
                </button>
              </div>
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground">Тегов пока нет.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <TagToggle
                        key={t.id}
                        tag={t}
                        selected={filterTags.includes(t.id)}
                        onToggle={() => toggleFilterTag(t.id)}
                      />
                    ))}
                  </div>
                  {filtering && (
                    <p className="text-xs text-muted-foreground">
                      Пока фильтр активен, порядок записей не меняется.
                    </p>
                  )}
                </>
              )}
              <div className="flex items-center justify-between gap-2 border-t pt-2">
                <Link
                  href="/tags"
                  className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
                >
                  Управление тегами
                </Link>
                {filtering && (
                  <Button size="sm" variant="ghost" onClick={() => setFilterTags([])}>
                    Сбросить
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>
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
      {/* Состояние фильтра видно на всех разрешениях: на мобильном кнопка — одна иконка. */}
      {filtering && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {tags
            .filter((t) => filterTags.includes(t.id))
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleFilterTag(t.id)}
                aria-label={`Убрать из фильтра: ${t.name}`}
                className="inline-flex items-center"
              >
                <TagBadge tag={t} className="gap-1 pr-1.5">
                  <X className="size-3" />
                </TagBadge>
              </button>
            ))}
          <span className="text-xs text-muted-foreground">
            Показано: {visible.length} из {placements.length}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => setFilterTags([])}
          >
            Сбросить
          </Button>
        </div>
      )}

      <div className="hidden overflow-x-auto md:block">
        <SortableRows
          ids={visible.map((p) => p.id)}
          onReorder={(ids) => reorder.mutate(ids)}
          disabled={filtering}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Название</TableHead>
                <TableHead>Теги</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-right">TRX</TableHead>
                <TableHead>Адрес / счёт</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => (
                <SortableRow key={p.id} id={p.id} disabled={filtering}>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {p.icon && <PlacementIcon icon={p.icon} className="size-3.5" />}
                      {p.name}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-40">
                    {p.tags.length > 0 ? (
                      compactTags ? (
                        <CompactTagList tags={p.tags} />
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {p.tags.map((t) => (
                            <TagBadge key={t.id} tag={t} />
                          ))}
                        </div>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
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
              {!isLoading && visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {filtering ? "Нет записей с выбранными тегами" : "Пока нет записей"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </SortableRows>
      </div>

      {/* Мобильный компактный список (2 строки на позицию): отдельный DndContext. */}
      <SortableRows
        ids={visible.map((p) => p.id)}
        onReorder={(ids) => reorder.mutate(ids)}
        disabled={filtering}
      >
        <ul className="space-y-2 md:hidden">
          {visible.map((p) => (
            <SortableCard key={p.id} id={p.id} disabled={filtering}>
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
                  {/* Третья строка появляется только у помеченных записей,
                      чтобы остальные карточки остались двухстрочными. */}
                  {p.tags.length > 0 && (
                    <span className="flex w-full items-center gap-1">
                      {compactTags ? (
                        <CompactTagList tags={p.tags} />
                      ) : (
                        p.tags.map((t) => <TagBadge key={t.id} tag={t} size="sm" />)
                      )}
                    </span>
                  )}
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
          {!isLoading && visible.length === 0 && (
            <li className="rounded-lg ring-1 ring-foreground/10 bg-card shadow-card px-3 py-4 text-center text-sm text-muted-foreground">
              {filtering ? "Нет записей с выбранными тегами" : "Пока нет записей"}
            </li>
          )}
        </ul>
      </SortableRows>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Изменить запись" : "Новая запись"}</DialogTitle>
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

      <DayTransactionsDialog open={dayTxOpen} onOpenChange={setDayTxOpen} />

      <PlacementsSummaryDialog
        open={summaryOpen}
        onOpenChange={setSummaryOpen}
        placements={placements}
      />
    </SectionCard>
  );
}
