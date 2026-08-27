"use client";

import { ArrowDownLeft, ArrowUpRight, ExternalLink, FilePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ServiceIcon } from "@/components/ServiceIcon";
import { UsdtIcon } from "@/components/UsdtAmount";
import { CHAIN_META, explorerAddressUrl, explorerTxUrl } from "@/lib/chains";
import { formatMskTime } from "@/lib/format";
import type { Chain, UsdtTransfer, WalletTransfer } from "@/types";

// Точные суммы переводов (в отличие от целочисленных сумм в таблицах).
const amountFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 });
const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function shortAddress(value: string): string {
  return value.length <= 14 ? value : `${value.slice(0, 6)}…${value.slice(-6)}`;
}

/**
 * Строка перевода USDT: попап истории кошелька и попап транзакций за день.
 * `walletName` показывается только в дневном списке (там кошельки перемешаны),
 * там же дата уже в заголовке — поэтому время можно сократить до «ЧЧ:ММ» по МСК.
 */
export function TransferRow({
  chain,
  transfer,
  onCreateDebt,
  walletName,
  showDate = true,
}: {
  chain: Chain;
  transfer: UsdtTransfer | WalletTransfer;
  onCreateDebt: () => void;
  walletName?: string;
  showDate?: boolean;
}) {
  const out = transfer.direction === "out";
  const counterparty = out ? transfer.to : transfer.from;
  const internalWith = (transfer as WalletTransfer).internal_with;
  const explorer = CHAIN_META[chain].explorerName;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span
        className={
          out
            ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
            : "flex size-8 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"
        }
        aria-label={out ? "Исходящий" : "Входящий"}
      >
        {out ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 font-medium tabular-nums">
          {out ? "−" : "+"}
          {amountFmt.format(transfer.amount)}
          <UsdtIcon className="size-3.5 shrink-0" />
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {walletName && (
            <>
              <span className="max-w-24 truncate" title={walletName}>
                {walletName}
              </span>
              {internalWith && (
                <span className="max-w-24 truncate" title={`Перевод между своими: → ${internalWith}`}>
                  → {internalWith}
                </span>
              )}
              <span aria-hidden>·</span>
            </>
          )}
          <span>{out ? "кому" : "от"}</span>
          <a
            href={explorerAddressUrl(chain, counterparty)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono hover:text-foreground hover:underline underline-offset-2"
            title={`Открыть адрес в ${explorer}`}
          >
            {shortAddress(counterparty)}
          </a>
          <span aria-hidden>·</span>
          <span>
            {transfer.timestamp
              ? showDate
                ? timeFmt.format(transfer.timestamp)
                : formatMskTime(transfer.timestamp)
              : "—"}
          </span>
        </div>
      </div>

      <a
        href={explorerTxUrl(chain, transfer.tx_id)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:text-foreground"
        title={`Транзакция в ${explorer}`}
        aria-label={`Транзакция в ${explorer}`}
      >
        <ExternalLink className="size-4" />
      </a>

      {out &&
        (transfer.debt ? (
          <span
            className={
              transfer.debt.deleted
                ? "flex shrink-0 items-center gap-1.5 opacity-40"
                : "flex shrink-0 items-center gap-1.5"
            }
            title={
              transfer.debt.deleted
                ? "Долг по этой транзакции был создан, но удалён (в архиве)"
                : "Долг по этой транзакции уже создан"
            }
          >
            <Badge variant={transfer.debt.deleted ? "outline" : "secondary"} className="max-w-32">
              <span className={transfer.debt.deleted ? "truncate line-through" : "truncate"}>
                {transfer.debt.manager_name ?? "Долг"}
              </span>
            </Badge>
            {transfer.debt.service && (
              <Badge variant={transfer.debt.deleted ? "outline" : "secondary"}>
                <ServiceIcon service={transfer.debt.service} className="size-3.5 rounded" />
                {transfer.debt.service}
              </Badge>
            )}
          </span>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={onCreateDebt}
            aria-label="Создать долг"
          >
            <FilePlus className="size-4" />
            <span className="hidden sm:inline">Создать долг</span>
          </Button>
        ))}
    </li>
  );
}
