"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddressCell } from "@/components/AddressCell";
import { UsdtAmount } from "@/components/UsdtAmount";
import { TrxAmount } from "@/components/TrxAmount";
import { Badge } from "@/components/ui/badge";
import { ServiceIcon } from "@/components/ServiceIcon";
import { ReconciliationPill } from "@/features/dashboard/HeroCard";
import { ACCOUNT_LABELS } from "@/features/placements/PlacementForm";
import { formatDate, formatDateTime } from "@/lib/format";
import { useSnapshot } from "@/hooks/useSnapshots";
import type { Debt } from "@/types";

function sourceLabel(debt: Debt): string {
  if (debt.placement_name) return debt.placement_name;
  if (debt.source_text) return debt.source_text;
  return "—";
}

/** Итоговая плитка снимка: подпись + сумма. */
function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {children}
      </CardContent>
    </Card>
  );
}

/** Полный снимок депо: итоги и замороженные копии всех блоков на момент создания. */
export function SnapshotView({ id }: { id: number }) {
  const { data: snapshot, isLoading, error } = useSnapshot(id);

  if (isLoading) {
    return <p className="text-muted-foreground py-8 text-center">Загрузка…</p>;
  }
  if (error || !snapshot) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        {(error as Error | null)?.message ?? "Снимок не найден"}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm text-muted-foreground tabular-nums">
          Создан {formatDateTime(snapshot.created_at)}
        </span>
        <ReconciliationPill balanced={snapshot.balanced} diff={snapshot.diff} />
      </div>
      {snapshot.comment && <p className="text-sm text-muted-foreground">{snapshot.comment}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Всего в депо">
          <UsdtAmount
            value={snapshot.total_funds}
            className="text-2xl font-semibold tracking-tight"
            iconClassName="size-5"
          />
        </StatTile>
        <StatTile label="Размещено">
          <UsdtAmount
            value={snapshot.total_placements}
            className="text-2xl font-semibold tracking-tight"
            iconClassName="size-5"
          />
        </StatTile>
        <StatTile label="Долги">
          <UsdtAmount
            value={snapshot.total_debts}
            className="text-2xl font-semibold tracking-tight"
            iconClassName="size-5"
          />
        </StatTile>
        <StatTile label="Всего TRX">
          <TrxAmount
            value={snapshot.total_trx}
            className="text-2xl font-semibold tracking-tight"
            iconClassName="size-5"
          />
        </StatTile>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Средства</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.funds.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      <UsdtAmount value={f.amount} />
                    </TableCell>
                  </TableRow>
                ))}
                {snapshot.funds.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                      Нет записей
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Размещения</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Адрес / счёт</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead className="text-right">TRX</TableHead>
                  <TableHead>Комментарий</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.placements.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.kind === "exchange" && p.exchange && p.exchange_account ? (
                        <span className="font-sans">
                          {p.exchange} · {ACCOUNT_LABELS[p.exchange_account]}
                        </span>
                      ) : (
                        <AddressCell address={p.address} />
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <UsdtAmount value={p.amount} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {p.trx_amount === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <TrxAmount value={p.trx_amount} />
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-48 truncate">
                      {p.comment ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {snapshot.placements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Нет записей
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Долги</CardTitle>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshot.debts.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.manager_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatDate(d.date)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <UsdtAmount value={d.amount} />
                    </TableCell>
                    <TableCell>
                      {d.service ? (
                        <Badge variant="secondary" className="gap-1.5 pl-1">
                          <ServiceIcon service={d.service} className="size-4" />
                          {d.service}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{sourceLabel(d)}</TableCell>
                    <TableCell className="text-muted-foreground max-w-48 truncate">
                      {d.comment ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
                {snapshot.debts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      Нет записей
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
