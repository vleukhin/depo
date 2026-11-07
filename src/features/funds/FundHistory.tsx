"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArchivePagination } from "@/components/ArchivePagination";
import { UsdtAmount } from "@/components/UsdtAmount";
import { formatDateTime, formatUsdt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useFundHistory } from "@/hooks/useFunds";
import type { FundChange, FundChangeAction } from "@/types";

const ACTION_LABEL: Record<FundChangeAction, string> = {
  create: "Добавлено",
  update: "Изменено",
  delete: "Удалено",
};

const ACTION_VARIANT: Record<FundChangeAction, "secondary" | "outline" | "destructive"> = {
  create: "secondary",
  update: "outline",
  delete: "destructive",
};

/** Цвет разницы: рост — зелёный, падение — красный, ноль — приглушённый. */
const deltaClass = (v: number) =>
  v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground";

/** Что именно поменялось: «1 000 → 1 500», «было «Старое название»». */
function ChangeDetails({ change }: { change: FundChange }) {
  const parts: React.ReactNode[] = [];
  if (change.action === "update" && change.prev_amount !== null && change.delta !== 0) {
    parts.push(
      <span key="amount" className="tabular-nums">
        {formatUsdt(change.prev_amount)} → {formatUsdt(change.amount)}
      </span>,
    );
  }
  if (change.prev_name !== null) {
    parts.push(<span key="name">было «{change.prev_name}»</span>);
  }
  if (parts.length === 0) return null;
  return <span className="inline-flex flex-wrap gap-x-2 text-muted-foreground">{parts}</span>;
}

function ActionBadge({ action }: { action: FundChangeAction }) {
  return <Badge variant={ACTION_VARIANT[action]}>{ACTION_LABEL[action]}</Badge>;
}

/** История изменений состава депо: кто внёс, вывел, переименован, удалён. */
export function FundHistory() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isPlaceholderData } = useFundHistory(page);
  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>История состава депо</CardTitle>
        <CardDescription>
          Каждое добавление, изменение и удаление средства. «Итого» — сумма всех средств сразу
          после изменения.
        </CardDescription>
      </CardHeader>
      <CardContent className={isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Когда</TableHead>
                <TableHead>Средство</TableHead>
                <TableHead>Изменение</TableHead>
                <TableHead className="text-right">Разница</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-right">Итого</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell
                    className="text-muted-foreground whitespace-nowrap tabular-nums"
                    title={`${c.created_at} UTC`}
                  >
                    {formatDateTime(c.created_at)}
                  </TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <ActionBadge action={c.action} />
                      <ChangeDetails change={c} />
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <UsdtAmount value={c.delta} signed className={deltaClass(c.delta)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <UsdtAmount value={c.amount} />
                  </TableCell>
                  <TableCell className="text-right">
                    <UsdtAmount value={c.total_after} className="text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Изменений пока не было
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Мобильный список карточек. */}
        <ul className="space-y-2 md:hidden">
          {items.map((c) => (
            <li
              key={c.id}
              className="rounded-lg ring-1 ring-foreground/10 bg-card shadow-card p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-medium">{c.name}</span>
                <UsdtAmount
                  value={c.delta}
                  signed
                  className={cn("text-base font-semibold", deltaClass(c.delta))}
                />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <ActionBadge action={c.action} />
                <ChangeDetails change={c} />
              </div>
              <dl className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-baseline justify-between gap-3">
                  <dt>Когда</dt>
                  <dd className="tabular-nums text-foreground" title={`${c.created_at} UTC`}>
                    {formatDateTime(c.created_at)}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Сумма после</dt>
                  <dd className="text-foreground">
                    <UsdtAmount value={c.amount} />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt>Итого средств</dt>
                  <dd>
                    <UsdtAmount value={c.total_after} />
                  </dd>
                </div>
              </dl>
            </li>
          ))}
          {!isLoading && items.length === 0 && (
            <li className="rounded-lg ring-1 ring-foreground/10 bg-card shadow-card p-3 text-center text-sm text-muted-foreground">
              Изменений пока не было
            </li>
          )}
        </ul>

        <ArchivePagination data={data} onPageChange={setPage} />
      </CardContent>
    </Card>
  );
}
