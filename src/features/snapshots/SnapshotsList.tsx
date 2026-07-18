"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteButton } from "@/components/DeleteButton";
import { UsdtAmount } from "@/components/UsdtAmount";
import { TrxAmount } from "@/components/TrxAmount";
import { ReconciliationPill } from "@/features/dashboard/HeroCard";
import { formatDateTime } from "@/lib/format";
import { useDeleteSnapshot, useSnapshots } from "@/hooks/useSnapshots";

const DELETE_DESC = "Снимок будет удалён без возможности восстановления.";

/** Список всех снимков депо: итоги по блокам, клик по дате открывает полный снимок. */
export function SnapshotsList() {
  const { data: snapshots = [], isLoading } = useSnapshots();
  const del = useDeleteSnapshot();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Все снимки</CardTitle>
        <CardDescription>
          Замороженные копии состояния депо. Нажмите на снимок, чтобы посмотреть все блоки на
          момент его создания.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Дата</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead className="text-right">Депо</TableHead>
                <TableHead className="text-right">Размещено</TableHead>
                <TableHead className="text-right">Долги</TableHead>
                <TableHead className="text-right">TRX</TableHead>
                <TableHead>Сверка</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    <Link
                      href={`/snapshots/${s.id}`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {formatDateTime(s.created_at)}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-64 truncate">
                    {s.comment ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <UsdtAmount value={s.total_funds} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <UsdtAmount value={s.total_placements} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <UsdtAmount value={s.total_debts} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <TrxAmount value={s.total_trx} />
                  </TableCell>
                  <TableCell>
                    <ReconciliationPill balanced={s.balanced} diff={s.diff} />
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteButton
                      description={DELETE_DESC}
                      onConfirm={() => del.mutateAsync(s.id)}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && snapshots.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Пока нет снимков
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Мобильный список карточек: клик по карточке открывает полный снимок. */}
        <ul className="space-y-2 md:hidden">
          {snapshots.map((s) => (
            <li key={s.id} className="rounded-lg ring-1 ring-foreground/10 bg-card shadow-card p-3">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/snapshots/${s.id}`} className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {formatDateTime(s.created_at)}
                    </span>
                    <ReconciliationPill balanced={s.balanced} diff={s.diff} />
                  </div>
                  {s.comment && (
                    <p className="truncate text-xs text-muted-foreground">{s.comment}</p>
                  )}
                </Link>
                <DeleteButton
                  className="size-8 shrink-0"
                  description={DELETE_DESC}
                  onConfirm={() => del.mutateAsync(s.id)}
                />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-baseline justify-between gap-2">
                  <dt>Депо</dt>
                  <dd>
                    <UsdtAmount value={s.total_funds} className="text-foreground" />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt>Размещено</dt>
                  <dd>
                    <UsdtAmount value={s.total_placements} className="text-foreground" />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt>Долги</dt>
                  <dd>
                    <UsdtAmount value={s.total_debts} className="text-foreground" />
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <dt>TRX</dt>
                  <dd>
                    <TrxAmount value={s.total_trx} className="text-foreground" />
                  </dd>
                </div>
              </dl>
            </li>
          ))}
          {!isLoading && snapshots.length === 0 && (
            <li className="rounded-lg ring-1 ring-foreground/10 bg-card shadow-card px-3 py-4 text-center text-sm text-muted-foreground">
              Пока нет снимков
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
