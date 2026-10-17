"use client";

import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UsdtAmount } from "@/components/UsdtAmount";
import { GasAmount, formatGas } from "@/components/GasAmount";
import { ReconciliationPill } from "@/components/ReconciliationPill";
import { ACCOUNT_LABELS } from "@/features/placements/PlacementForm";
import { StatTile } from "@/features/snapshots/StatTile";
import { CompareSelect } from "@/features/snapshots/CompareSelect";
import { CHAIN_META } from "@/lib/chains";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSnapshotDiff } from "@/hooks/useSnapshots";
import {
  CHAINS,
  type Chain,
  type Debt,
  type EntityDiff,
  type ExchangeAccount,
  type FieldChange,
  type Fund,
  type Placement,
} from "@/types";

/** Цвет дельты: рост — зелёный, падение — красный, ноль — приглушённый. */
const deltaClass = (v: number) =>
  v > 0 ? "text-success" : v < 0 ? "text-destructive" : "text-muted-foreground";

function UsdtDelta({ value, className }: { value: number; className?: string }) {
  return <UsdtAmount value={value} signed className={cn(deltaClass(value), className)} />;
}

function GasDelta({ chain, value }: { chain: Chain; value: number }) {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return (
    <span className={cn("tabular-nums", deltaClass(value))}>
      {sign}
      {formatGas(chain, Math.abs(value))} {CHAIN_META[chain].gasLabel}
    </span>
  );
}

/** Значение поля «было»/«стало» в виде, привычном по остальным экранам. */
function FieldValue({ change, value }: { change: FieldChange; value: string | number | null }) {
  if (value === null || value === "") return <span className="text-muted-foreground">—</span>;
  if (change.kind === "usdt" && typeof value === "number") return <UsdtAmount value={value} />;
  if (change.kind === "gas" && typeof value === "number" && change.chain)
    return <GasAmount chain={change.chain} value={value} />;
  if (change.kind === "date") return <span className="tabular-nums">{formatDate(String(value))}</span>;
  if (change.field === "exchange_account")
    return <span>{ACCOUNT_LABELS[value as ExchangeAccount] ?? value}</span>;
  return <span className="break-all">{value}</span>;
}

function FieldChanges({ fields }: { fields: FieldChange[] }) {
  return (
    <dl className="mt-2 space-y-1 text-sm">
      {fields.map((f) => (
        <div key={f.field} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <dt className="w-28 shrink-0 text-muted-foreground">{f.label}</dt>
          <dd className="flex min-w-0 flex-wrap items-center gap-x-2">
            <span className="text-muted-foreground line-through decoration-muted-foreground/40">
              <FieldValue change={f} value={f.before} />
            </span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
            <FieldValue change={f} value={f.after} />
            {f.delta !== null &&
              (f.kind === "gas" && f.chain ? (
                <GasDelta chain={f.chain} value={f.delta} />
              ) : (
                <UsdtDelta value={f.delta} />
              ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

type RowStatus = "added" | "removed" | "changed";

const STATUS_BADGE: Record<RowStatus, { label: string; className: string }> = {
  added: { label: "Добавлена", className: "bg-success/10 text-success" },
  removed: { label: "Удалена", className: "bg-destructive/10 text-destructive" },
  changed: { label: "Изменена", className: "bg-secondary text-secondary-foreground" },
};

function ChangeRow({
  status,
  title,
  amount,
  children,
}: {
  status: RowStatus;
  title: React.ReactNode;
  amount?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const badge = STATUS_BADGE[status];
  return (
    <li className="rounded-lg p-3 ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge className={badge.className}>{badge.label}</Badge>
        <span className={cn("min-w-0 font-medium", status === "removed" && "line-through")}>
          {title}
        </span>
        {amount && <span className="ml-auto tabular-nums">{amount}</span>}
      </div>
      {children}
    </li>
  );
}

/** Блок изменений одной сущности: добавленные, изменённые, удалённые записи. */
function EntitySection<T extends { id: number }>({
  title,
  diff,
  renderTitle,
  renderAmount,
}: {
  title: string;
  diff: EntityDiff<T>;
  renderTitle: (row: T) => React.ReactNode;
  renderAmount: (row: T) => React.ReactNode;
}) {
  const total = diff.added.length + diff.removed.length + diff.changed.length;
  const parts = [
    diff.added.length > 0 && `добавлено ${diff.added.length}`,
    diff.changed.length > 0 && `изменено ${diff.changed.length}`,
    diff.removed.length > 0 && `удалено ${diff.removed.length}`,
    `без изменений ${diff.unchanged}`,
  ].filter(Boolean);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{parts.join(" · ")}</CardDescription>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Изменений нет</p>
        ) : (
          <ul className="space-y-2">
            {diff.added.map((r) => (
              <ChangeRow key={`a${r.id}`} status="added" title={renderTitle(r)} amount={renderAmount(r)} />
            ))}
            {diff.changed.map((c) => (
              <ChangeRow key={`c${c.id}`} status="changed" title={renderTitle(c.after)}>
                <FieldChanges fields={c.fields} />
              </ChangeRow>
            ))}
            {diff.removed.map((r) => (
              <ChangeRow
                key={`r${r.id}`}
                status="removed"
                title={renderTitle(r)}
                amount={renderAmount(r)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

const fundTitle = (f: Fund) => f.name;
const fundAmount = (f: Fund) => <UsdtAmount value={f.amount} />;

const placementTitle = (p: Placement) => (
  <>
    {p.name}{" "}
    <span className="text-xs font-normal text-muted-foreground">{CHAIN_META[p.chain].label}</span>
  </>
);
const placementAmount = (p: Placement) => (
  <span className="inline-flex items-center gap-3">
    <UsdtAmount value={p.amount} />
    {p.native_amount !== null && (
      <GasAmount chain={p.chain} value={p.native_amount} className="text-muted-foreground" />
    )}
  </span>
);

const debtTitle = (d: Debt) => (
  <>
    {d.manager_name ?? "—"}{" "}
    <span className="text-xs font-normal text-muted-foreground tabular-nums">
      {formatDate(d.date)}
      {d.service && ` · ${d.service}`}
    </span>
  </>
);
const debtAmount = (d: Debt) => <UsdtAmount value={d.amount} />;

/** Плитка итога: «стало», под ней «было» и дельта. */
function TotalTile({
  label,
  before,
  after,
  delta,
}: {
  label: string;
  before: number;
  after: number;
  delta: number; // считает сервер в micro — без дрейфа float
}) {
  return (
    <StatTile label={label}>
      <UsdtAmount value={after} className="text-2xl font-semibold tracking-tight" iconClassName="size-5" />
      <p className="flex flex-wrap items-center gap-x-2 text-sm">
        <span className="text-muted-foreground">
          было <UsdtAmount value={before} />
        </span>
        <UsdtDelta value={delta} />
      </p>
    </StatTile>
  );
}

/** Сравнение снимка (было) с другим снимком или текущим депо (стало). */
export function SnapshotDiffView({ id, target }: { id: number; target: string }) {
  const { data, isLoading, error } = useSnapshotDiff(id, target);

  if (isLoading) {
    return <p className="text-muted-foreground py-8 text-center">Загрузка…</p>;
  }
  if (error || !data) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        {(error as Error | null)?.message ?? "Снимок не найден"}
      </p>
    );
  }

  // Газ показываем только по сетям, где он был или есть.
  const gasChains = CHAINS.filter(
    (c) => data.before.total_native[c] !== 0 || data.after.total_native[c] !== 0,
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Было:</span>
          <span className="font-medium tabular-nums">{formatDateTime(data.base.created_at)}</span>
          <ReconciliationPill balanced={data.before.balanced} diff={data.before.diff} />
        </span>
        <ArrowRight className="size-4 text-muted-foreground" />
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Стало:</span>
          <span className="font-medium tabular-nums">
            {data.target ? formatDateTime(data.target.created_at) : "текущее состояние"}
          </span>
          <ReconciliationPill balanced={data.after.balanced} diff={data.after.diff} />
        </span>
        <div className="sm:ml-auto">
          <CompareSelect id={id} value={target} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TotalTile
          label="Всего в депо"
          before={data.before.total_funds}
          after={data.after.total_funds}
          delta={data.delta.total_funds}
        />
        <TotalTile
          label="Свободные средства"
          before={data.before.total_placements}
          after={data.after.total_placements}
          delta={data.delta.total_placements}
        />
        <TotalTile
          label="Долги"
          before={data.before.total_debts}
          after={data.after.total_debts}
          delta={data.delta.total_debts}
        />
        <StatTile label="Газ">
          {gasChains.length === 0 ? (
            <p className="text-2xl font-semibold tracking-tight">—</p>
          ) : (
            <ul className="space-y-1">
              {gasChains.map((c) => (
                <li key={c} className="flex flex-wrap items-center gap-x-2">
                  <GasAmount
                    chain={c}
                    value={data.after.total_native[c]}
                    className="text-lg font-semibold"
                    iconClassName="size-4"
                  />
                  <span className="text-sm">
                    <GasDelta chain={c} value={data.delta.total_native[c]} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </StatTile>
      </div>

      <EntitySection
        title="Средства"
        diff={data.funds}
        renderTitle={fundTitle}
        renderAmount={fundAmount}
      />
      <EntitySection
        title="Свободные средства"
        diff={data.placements}
        renderTitle={placementTitle}
        renderAmount={placementAmount}
      />
      <EntitySection
        title="Долги"
        diff={data.debts}
        renderTitle={debtTitle}
        renderAmount={debtAmount}
      />
    </div>
  );
}
