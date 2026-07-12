"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UsdtIcon } from "@/components/UsdtAmount";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  placementInput,
  type PlacementFormValues,
  type PlacementInput,
} from "@/lib/validate";
import { useCreatePlacement, useUpdatePlacement } from "@/hooks/usePlacements";
import {
  EXCHANGE_ACCOUNTS,
  EXCHANGES,
  type Exchange,
  type ExchangeAccount,
  type Placement,
  type PlacementKind,
} from "@/types";

const KIND_LABELS: Record<PlacementKind, string> = {
  wallet: "Внешний кошелёк",
  exchange: "Биржа",
};

// Подписи типов счёта на бирже; используются и в таблице раздела.
export const ACCOUNT_LABELS: Record<ExchangeAccount, string> = {
  spot: "Спотовый",
  main: "Основной",
};

export function PlacementForm({
  placement,
  onDone,
}: {
  placement?: Placement;
  onDone: () => void;
}) {
  const create = useCreatePlacement();
  const update = useUpdatePlacement();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PlacementFormValues, unknown, PlacementInput>({
    resolver: zodResolver(placementInput),
    defaultValues: {
      name: placement?.name ?? "",
      amount: placement?.amount ?? 0,
      kind: placement?.kind ?? "wallet",
      address: placement?.address ?? "",
      exchange: placement?.exchange ?? null,
      exchange_account: placement?.exchange_account ?? null,
      comment: placement?.comment ?? "",
    },
  });

  const kind = watch("kind");
  const exchange = watch("exchange");
  const exchangeAccount = watch("exchange_account");

  const submitting = create.isPending || update.isPending;

  async function onSubmit(values: PlacementInput) {
    try {
      if (placement) await update.mutateAsync({ id: placement.id, input: values });
      else await create.mutateAsync(values);
      toast.success(placement ? "Изменения сохранены" : "Размещение добавлено");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="p-name">Название</Label>
          <Input id="p-name" placeholder="Напр. Binance" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-amount" className="gap-1">
            Сумма, <UsdtIcon className="size-3.5" />
          </Label>
          <Input
            id="p-amount"
            type="number"
            step="1"
            min="0"
            placeholder="0"
            {...register("amount", { valueAsNumber: true })}
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>
      </div>
      <div className="space-y-2">
        <Label>Тип размещения</Label>
        <Select
          value={kind}
          onValueChange={(v) => setValue("kind", v as PlacementKind)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(KIND_LABELS) as [PlacementKind, string][]).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {kind === "exchange" ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Биржа</Label>
            <Select
              value={exchange ?? ""}
              onValueChange={(v) =>
                setValue("exchange", v as Exchange, { shouldValidate: true })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите биржу" />
              </SelectTrigger>
              <SelectContent>
                {EXCHANGES.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.exchange && (
              <p className="text-sm text-destructive">{errors.exchange.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Счёт</Label>
            <Select
              value={exchangeAccount ?? ""}
              onValueChange={(v) =>
                setValue("exchange_account", v as ExchangeAccount, { shouldValidate: true })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Выберите счёт" />
              </SelectTrigger>
              <SelectContent>
                {EXCHANGE_ACCOUNTS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {ACCOUNT_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.exchange_account && (
              <p className="text-sm text-destructive">{errors.exchange_account.message}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="p-address">Адрес</Label>
          <Input id="p-address" placeholder="Адрес кошелька / счёта" {...register("address")} />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="p-comment">Комментарий</Label>
        <Textarea id="p-comment" rows={2} {...register("comment")} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Сохранение…" : "Сохранить"}
        </Button>
      </DialogFooter>
    </form>
  );
}
