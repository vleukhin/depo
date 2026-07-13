"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TrxIcon } from "@/components/TrxAmount";
import { isTronAddress } from "@/lib/tron";
import { useExchangeTrxInfo, useWithdrawTrx } from "@/hooks/usePlacements";
import type { Exchange, Placement } from "@/types";

// Пока on-chain вывод TRX реализован только для Bitget (структура — под будущие биржи).
const WITHDRAW_EXCHANGES: Exchange[] = ["Bitget"];

// Локальный форматтер TRX: точные суммы с группировкой (в отличие от таблицы,
// где TRX округляется до целых) — на экране вывода важна точность.
const trxFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 6 });

export function TrxTopUpDialog({
  placement,
  open,
  onOpenChange,
}: {
  placement: Placement;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [exchange, setExchange] = useState<Exchange>("Bitget");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");

  const info = useExchangeTrxInfo(exchange, "spot", open);
  const withdraw = useWithdrawTrx();

  const address = placement.address ?? "";
  const amountNum = Number(amount.replace(",", "."));
  const balance = info.data?.balance ?? null;
  const fee = info.data?.fee ?? null;
  const min = info.data?.min ?? null;
  const net = fee != null ? amountNum - fee : null;

  // Границы суммы известны только в рантайме (из данных биржи), поэтому валидация — вручную.
  const amountError = (() => {
    if (amount.trim() === "") return null;
    if (!Number.isFinite(amountNum) || amountNum <= 0) return "Некорректная сумма";
    if (min != null && amountNum < min) return `Минимум ${trxFmt.format(min)} TRX`;
    if (balance != null && amountNum > balance) return "Больше баланса на бирже";
    return null;
  })();

  const canProceed =
    amount.trim() !== "" && amountError == null && !info.isLoading && !info.isError;

  function handleOpenChange(v: boolean) {
    if (!v) {
      setAmount("");
      setStep("form");
    }
    onOpenChange(v);
  }

  async function submit() {
    try {
      const res = await withdraw.mutateAsync({
        placementId: placement.id,
        exchange,
        amount: amountNum,
      });
      toast.success(`Заявка на вывод создана (orderId: ${res.orderId})`);
      handleOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Пополнить TRX — {placement.name}</DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Биржа</Label>
              <Select value={exchange} onValueChange={(v) => setExchange(v as Exchange)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WITHDRAW_EXCHANGES.map((e) => (
                    <SelectItem key={e} value={e}>
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Адрес получателя</Label>
              {isTronAddress(address) ? (
                <a
                  href={`https://tronscan.org/#/address/${address.trim()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
                >
                  <span className="break-all">{address}</span>
                  <ExternalLink className="size-3 shrink-0" />
                </a>
              ) : (
                <p className="font-mono text-xs text-muted-foreground break-all">{address}</p>
              )}
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              {info.isLoading ? (
                <span className="text-muted-foreground">Загрузка баланса…</span>
              ) : info.isError ? (
                <span className="text-destructive">{(info.error as Error).message}</span>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Баланс на {exchange} (спот)</span>
                    <span className="inline-flex items-center gap-1 tabular-nums font-medium">
                      {trxFmt.format(balance ?? 0)} <TrxIcon className="size-3.5" />
                    </span>
                  </div>
                  {(fee != null || min != null) && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{min != null ? `Минимум: ${trxFmt.format(min)} TRX` : ""}</span>
                      <span>{fee != null ? `Комиссия сети: ${trxFmt.format(fee)} TRX` : ""}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="trx-amount" className="gap-1">
                Сумма, <TrxIcon className="size-3.5" />
              </Label>
              <Input
                id="trx-amount"
                type="number"
                step="0.000001"
                min="0"
                inputMode="decimal"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              {amountError && <p className="text-sm text-destructive">{amountError}</p>}
            </div>

            <DialogFooter>
              <Button type="button" onClick={() => setStep("confirm")} disabled={!canProceed}>
                Далее
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm space-y-2">
              <Row label="Биржа" value={exchange} />
              <Row label="Сумма к списанию" value={`${trxFmt.format(amountNum)} TRX`} />
              {fee != null && <Row label="Комиссия сети" value={`${trxFmt.format(fee)} TRX`} />}
              {net != null && net > 0 && (
                <Row label="Дойдёт примерно" value={`${trxFmt.format(net)} TRX`} />
              )}
              <div className="space-y-1 pt-1">
                <span className="text-muted-foreground">Адрес получателя</span>
                <p className="font-mono text-xs break-all">{address}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Вывод необратим. Проверьте адрес и сумму перед подтверждением.
            </p>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("form")}
                disabled={withdraw.isPending}
              >
                Назад
              </Button>
              <Button type="button" onClick={submit} disabled={withdraw.isPending}>
                {withdraw.isPending ? "Вывод…" : "Вывести"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
