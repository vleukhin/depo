"use client";

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
import { UsdtAmount } from "@/components/UsdtAmount";
import { TrxAmount } from "@/components/TrxAmount";
import { formatDate } from "@/lib/format";
import { useDeletedPlacements, useRestorePlacement } from "@/hooks/usePlacements";
import { ACCOUNT_LABELS } from "./PlacementForm";

/** Архив размещений: только удалённые записи, их можно восстановить. */
export function PlacementsArchive() {
  const { data: placements = [], isLoading } = useDeletedPlacements();
  const restore = useRestorePlacement();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Архив размещений</CardTitle>
        <CardDescription>
          Удалённые записи: не входят в сверку и не проверяются балансами. Восстановленная запись
          вернётся в конец списка.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Название</TableHead>
                <TableHead className="text-right">Сумма</TableHead>
                <TableHead className="text-right">TRX</TableHead>
                <TableHead>Адрес / счёт</TableHead>
                <TableHead>Комментарий</TableHead>
                <TableHead>Удалено</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {placements.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">
                    <UsdtAmount value={p.amount} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {p.trx_amount != null ? <TrxAmount value={p.trx_amount} /> : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground max-w-56 truncate">
                    {p.kind === "exchange" && p.exchange && p.exchange_account ? (
                      <span className="font-sans">
                        {p.exchange} · {ACCOUNT_LABELS[p.exchange_account]}
                      </span>
                    ) : (
                      (p.address ?? "—")
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-48 truncate">
                    {p.comment ?? "—"}
                  </TableCell>
                  <TableCell
                    className="text-muted-foreground whitespace-nowrap tabular-nums"
                    title={p.deleted_at ? `${p.deleted_at} UTC` : undefined}
                  >
                    {p.deleted_at ? formatDate(p.deleted_at.slice(0, 10)) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <RestoreButton onConfirm={() => restore.mutateAsync(p.id)} />
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && placements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
