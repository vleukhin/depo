"use client";

import { useState } from "react";
import { ExternalLink, Pencil, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { formatUsdt } from "@/lib/format";
import { isTronAddress } from "@/lib/tron";
import {
  useCheckBalances,
  useDeletePlacement,
  usePlacements,
  useReorderPlacements,
} from "@/hooks/usePlacements";
import type { Placement } from "@/types";
import { ACCOUNT_LABELS, PlacementForm } from "./PlacementForm";

function AddressCell({ address }: { address: string | null }) {
  if (!address) return <span className="text-muted-foreground">—</span>;
  if (!isTronAddress(address)) return <>{address}</>;
  return (
    <a
      href={`https://tronscan.org/#/address/${address.trim()}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 hover:text-foreground hover:underline underline-offset-2"
      title="Открыть в Tronscan"
    >
      <span className="max-w-36 truncate">{address}</span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

export function PlacementsSection() {
  const { data: placements = [], isLoading } = usePlacements();
  const del = useDeletePlacement();
  const reorder = useReorderPlacements();
  const check = useCheckBalances();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Placement | undefined>(undefined);

  function openCreate() {
    setEditing(undefined);
    setOpen(true);
  }
  function openEdit(placement: Placement) {
    setEditing(placement);
    setOpen(true);
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
        <Button
          size="sm"
          variant="outline"
          onClick={checkBalances}
          disabled={check.isPending}
        >
          <RefreshCw className={check.isPending ? "size-4 animate-spin" : "size-4"} />
          {check.isPending ? "Проверка…" : "Проверить балансы"}
        </Button>
      }
    >
      <div className="overflow-x-auto">
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
                <TableHead>Адрес / счёт</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {placements.map((p) => (
                <SortableRow key={p.id} id={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell
                    className="text-right tabular-nums"
                    title={
                      p.chain_checked_at
                        ? `Обновлено автоматически: ${p.chain_checked_at} UTC`
                        : undefined
                    }
                  >
                    {formatUsdt(p.amount)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-40">
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
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Изменить"
                      onClick={() => openEdit(p)}
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </Button>
                    <DeleteButton
                      description="Размещение будет удалено. У связанных долгов источник станет пустым."
                      onConfirm={() => del.mutateAsync(p.id)}
                    />
                  </TableCell>
                </SortableRow>
              ))}
              {!isLoading && placements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
            <DialogTitle>{editing ? "Изменить размещение" : "Новое размещение"}</DialogTitle>
          </DialogHeader>
          <PlacementForm placement={editing} onDone={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}
