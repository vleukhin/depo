"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEnergyRentalQuote, useRentEnergy } from "@/hooks/usePlacements";
import type { BandwidthDuration, Placement } from "@/types";
import { coinFmt, RecipientAddress, Row } from "./GasTopUpParts";

// Потолок совпадает с energyRentParams в lib/validate.ts.
const MAX_TRANSFERS = 30;

const unitsFmt = new Intl.NumberFormat("ru-RU");

const BANDWIDTH_LABELS: Record<BandwidthDuration, string> = {
  none: "Не нужен",
  "1h": "На 1 час",
  "1d": "На сутки",
};

/**
 * Аренда энергии (+ опционально bandwidth) в TronRental на адрес TRON-кошелька —
 * чтобы переводы USDT не сжигали TRX. Объём задаётся числом переводов, цену и
 * баланс аккаунта TronRental котирует сервер.
 */
export function EnergyRentalPanel({
  placement,
  onDone,
}: {
  placement: Placement;
  onDone: () => void;
}) {
  const [transfersRaw, setTransfersRaw] = useState("1");
  const [newRecipient, setNewRecipient] = useState(false);
  const [bandwidth, setBandwidth] = useState<BandwidthDuration>("none");
  const [step, setStep] = useState<"form" | "confirm">("form");

  const transfers = Number(transfersRaw);
  const transfersError =
    transfersRaw === ""
      ? null
      : transfers < 1
        ? "Минимум 1 перевод"
        : transfers > MAX_TRANSFERS
          ? `Максимум ${MAX_TRANSFERS} переводов`
          : null;
  const transfersValid = transfersRaw !== "" && transfersError == null;

  const quote = useEnergyRentalQuote({ transfers, newRecipient, bandwidth }, transfersValid);
  const rent = useRentEnergy();
  const q = quote.data;

  // Пока грузится котировка для новых параметров, на экране остаётся прошлая
  // (keepPreviousData) — пускать по ней дальше нельзя, цена другая.
  const quoteReady = transfersValid && !!q && !quote.isPlaceholderData && !quote.isError;
  const notEnough = quoteReady && q.total > q.balance;
  const canProceed = quoteReady && !notEnough;

  async function submit() {
    try {
      const res = await rent.mutateAsync({
        placementId: placement.id,
        transfers,
        newRecipient,
        bandwidth,
      });
      const ids = [res.energyOrderId, res.bandwidthOrderId].filter((id) => id != null);
      toast.success(`Энергия арендована (заказ ${ids.join(", ")})`);
      if (res.bandwidthError) {
        toast.warning(`Bandwidth не арендован: ${res.bandwidthError}`);
      }
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (step === "confirm" && q) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border p-3 text-sm space-y-2">
          <Row label="Сервис" value="TronRental" />
          <Row label="Переводов USDT" value={String(transfers)} />
          <Row
            label="Энергия (1 час)"
            value={`${unitsFmt.format(q.energy.volume)} — ${coinFmt.format(q.energy.total)} TRX`}
          />
          {q.bandwidth && (
            <Row
              label={`Bandwidth (${BANDWIDTH_LABELS[q.bandwidth.duration].toLowerCase()})`}
              value={`${unitsFmt.format(q.bandwidth.volume)} — ${coinFmt.format(q.bandwidth.total)} TRX`}
            />
          )}
          <Row label="Итого с баланса TronRental" value={`${coinFmt.format(q.total)} TRX`} />
          <div className="space-y-1 pt-1">
            <span className="text-muted-foreground">Адрес получателя</span>
            <p className="font-mono text-xs break-all">{placement.address}</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Энергия действует 1 час — отправьте USDT в это время. Оплата необратима.
        </p>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep("form")}
            disabled={rent.isPending}
          >
            Назад
          </Button>
          <Button type="button" onClick={submit} disabled={rent.isPending}>
            {rent.isPending ? "Аренда…" : "Арендовать"}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <RecipientAddress placement={placement} />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="rent-transfers">Переводов USDT</Label>
          <Input
            id="rent-transfers"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={transfersRaw}
            onChange={(e) => {
              const v = e.target.value;
              if (/^\d{0,3}$/.test(v)) setTransfersRaw(v);
            }}
          />
        </div>
        <div className="space-y-2">
          <Label>Получатель USDT</Label>
          <Select
            value={newRecipient ? "new" : "holder"}
            onValueChange={(v) => setNewRecipient(v === "new")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="holder">Уже держит USDT</SelectItem>
              <SelectItem value="new">Новый</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {transfersError && <p className="text-sm text-destructive">{transfersError}</p>}

      <div className="space-y-2">
        <Label>Bandwidth</Label>
        <Select value={bandwidth} onValueChange={(v) => setBandwidth(v as BandwidthDuration)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(BANDWIDTH_LABELS) as BandwidthDuration[]).map((d) => (
              <SelectItem key={d} value={d}>
                {BANDWIDTH_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Нужен, только если у адреса кончился бесплатный дневной bandwidth — иначе перевод сожжёт
          немного TRX.
        </p>
      </div>

      <div className="rounded-md border bg-muted/40 p-3 text-sm">
        {quote.isError ? (
          <span className="text-destructive">{(quote.error as Error).message}</span>
        ) : !q ? (
          <span className="text-muted-foreground">
            {transfersValid ? "Загрузка цены…" : "Укажите число переводов"}
          </span>
        ) : (
          <div className={`space-y-1 ${quoteReady ? "" : "opacity-60"}`}>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Баланс TronRental</span>
              <span className="tabular-nums font-medium">{coinFmt.format(q.balance)} TRX</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Энергия {unitsFmt.format(q.energy.volume)}</span>
              <span className="tabular-nums">{coinFmt.format(q.energy.total)} TRX</span>
            </div>
            {q.bandwidth && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Bandwidth {unitsFmt.format(q.bandwidth.volume)}</span>
                <span className="tabular-nums">{coinFmt.format(q.bandwidth.total)} TRX</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Итого</span>
              <span className="tabular-nums font-medium">{coinFmt.format(q.total)} TRX</span>
            </div>
          </div>
        )}
      </div>
      {notEnough && (
        <p className="text-sm text-destructive">Недостаточно средств на балансе TronRental</p>
      )}

      <DialogFooter>
        <Button type="button" onClick={() => setStep("confirm")} disabled={!canProceed}>
          Далее
        </Button>
      </DialogFooter>
    </div>
  );
}
