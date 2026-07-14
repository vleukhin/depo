"use client";

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
        <div className="overflow-x-auto">
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
                      <Badge variant="secondary">{debt.service}</Badge>
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
      </CardContent>
    </Card>
  );
}
