"use client";

import { Badge } from "@/components/ui/badge";
import { ServiceIcon } from "@/components/ServiceIcon";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RestoreButton } from "@/components/RestoreButton";
import { formatDate, formatUsdt } from "@/lib/format";
import { useDeletedDebts, useRestoreDebt } from "@/hooks/useDebts";
import type { Debt } from "@/types";

// В архивной выборке имя источника приходит даже для удалённых размещений
// (+ флаг placement_deleted_at, что источник сам в архиве).
function SourceCell({ debt }: { debt: Debt }) {
  if (debt.placement_name) {
    return (
      <span>
        {debt.placement_name}
        {debt.placement_deleted_at && (
          <span className="text-muted-foreground/70"> (в архиве)</span>
        )}
      </span>
    );
  }
  return <span>{debt.source_text ?? "—"}</span>;
}

/** Архив долгов: только удалённые записи, их можно восстановить. */
export function DebtsArchive() {
  const { data: debts = [], isLoading } = useDeletedDebts();
  const restore = useRestoreDebt();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Архив долгов</CardTitle>
        <CardDescription>
          Удалённые записи: не входят в сверку. Восстановленная запись вернётся в конец списка.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Менеджер</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead>Сервис</TableHead>
                <TableHead>Откуда взял</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead>Удалено</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {debts.map((debt) => (
                <TableRow key={debt.id}>
                  <TableCell className="font-medium">{debt.manager_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                    {formatDate(debt.date)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatUsdt(debt.amount)}
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
                  <TableCell className="text-muted-foreground">
                    <SourceCell debt={debt} />
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-48 truncate">
                    {debt.comment ?? "—"}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground whitespace-nowrap tabular-nums"
                    title={debt.deleted_at ? `${debt.deleted_at} UTC` : undefined}
                  >
                    {debt.deleted_at ? formatDate(debt.deleted_at.slice(0, 10)) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <RestoreButton onConfirm={() => restore.mutateAsync(debt.id)} />
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && debts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Архив пуст
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Мобильный список карточек (§7): без drag и правки, только восстановление. */}
        <ul className="space-y-2 md:hidden">
          {debts.map((debt) => (
            <li
              key={debt.id}
              className="rounded-lg ring-1 ring-foreground/10 bg-card shadow-card p-3"
            >
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
                    {debt.service ? (
                      <Badge variant="secondary" className="gap-1.5 pl-1">
                        <ServiceIcon service={debt.service} className="size-4" />
                        {debt.service}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt>Откуда взял</dt>
                  <dd className="text-right text-foreground">
                    <SourceCell debt={debt} />
                  </dd>
                </div>
                {debt.comment && (
                  <div>
                    <dt>Комментарий</dt>
                    <dd className="mt-0.5 text-foreground">{debt.comment}</dd>
                  </div>
                )}
                <div className="flex items-baseline justify-between gap-3">
                  <dt>Удалено</dt>
                  <dd
                    className="tabular-nums"
                    title={debt.deleted_at ? `${debt.deleted_at} UTC` : undefined}
                  >
                    {debt.deleted_at ? formatDate(debt.deleted_at.slice(0, 10)) : "—"}
                  </dd>
                </div>
              </dl>
              <div className="mt-2 flex items-center justify-end gap-1">
                <RestoreButton
                  className="size-11"
                  onConfirm={() => restore.mutateAsync(debt.id)}
                />
              </div>
            </li>
          ))}
          {!isLoading && debts.length === 0 && (
            <li className="rounded-lg ring-1 ring-foreground/10 bg-card shadow-card p-3 text-center text-sm text-muted-foreground">
              Архив пуст
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
