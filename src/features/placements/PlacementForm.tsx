"use client";

import Link from "next/link";
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
import { useTags } from "@/hooks/useTags";
import { TagToggle } from "@/components/TagBadge";
import {
  CHAINS,
  EXCHANGE_ACCOUNTS,
  EXCHANGES,
  type Chain,
  type Exchange,
  type ExchangeAccount,
  type Placement,
  type PlacementIconId,
  type PlacementKind,
} from "@/types";
import { PlacementIcon, PLACEMENT_ICON_OPTIONS } from "@/components/PlacementIcon";
import { NativeIcon } from "@/components/GasAmount";
import { CHAIN_META } from "@/lib/chains";

// Значение-заглушка для варианта «без иконки» (Select не допускает пустой value).
const NO_ICON = "__none__";

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
  const { data: tags = [] } = useTags();
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
      chain: placement?.chain ?? "tron",
      address: placement?.address ?? "",
      exchange: placement?.exchange ?? null,
      exchange_account: placement?.exchange_account ?? null,
      icon: placement?.icon ?? null,
      comment: placement?.comment ?? "",
      tag_ids: placement?.tags.map((t) => t.id) ?? [],
    },
  });

  const kind = watch("kind");
  const chain = watch("chain") ?? "tron";
  const exchange = watch("exchange");
  const exchangeAccount = watch("exchange_account");
  const icon = watch("icon");
  const tagIds = watch("tag_ids") ?? [];

  const submitting = create.isPending || update.isPending;

  async function onSubmit(values: PlacementInput) {
    try {
      if (placement) await update.mutateAsync({ id: placement.id, input: values });
      else await create.mutateAsync(values);
      toast.success(placement ? "Изменения сохранены" : "Запись добавлена");
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
            step="0.000001"
            min="0"
            placeholder="0"
            {...register("amount", { valueAsNumber: true })}
          />
          {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Где хранятся</Label>
          <Select
            value={kind}
            onValueChange={(v) => setValue("kind", v as PlacementKind, { shouldValidate: true })}
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
        <div className="space-y-2">
          <Label>Сеть</Label>
          <Select
            value={chain}
            onValueChange={(v) => setValue("chain", v as Chain, { shouldValidate: true })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHAINS.map((c) => (
                <SelectItem key={c} value={c}>
                  <span className="inline-flex items-center gap-1.5">
                    <NativeIcon chain={c} className="size-3.5" />
                    {CHAIN_META[c].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* У биржевой строки адреса нет — сеть задаёт только монету газа. */}
          {kind === "exchange" && (
            <p className="text-xs text-muted-foreground">
              Монета газа: {CHAIN_META[chain].native}
            </p>
          )}
        </div>
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
          <Input
            id="p-address"
            placeholder={`Адрес кошелька в сети ${CHAIN_META[chain].label}`}
            {...register("address")}
          />
          {errors.address && (
            <p className="text-sm text-destructive">{errors.address.message}</p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label>Иконка</Label>
        <Select
          value={icon ?? NO_ICON}
          onValueChange={(v) =>
            setValue("icon", v === NO_ICON ? null : (v as PlacementIconId))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_ICON}>
              <span className="text-muted-foreground">Без иконки</span>
            </SelectItem>
            {PLACEMENT_ICON_OPTIONS.map((opt) => (
              <SelectItem key={opt.id} value={opt.id}>
                <span className="inline-flex items-center gap-2">
                  <PlacementIcon icon={opt.id} className="size-4" />
                  {opt.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label>Теги</Label>
          <Link
            href="/tags"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
          >
            Управление тегами
          </Link>
        </div>
        {/* Чипы прямо в форме, без Popover: список короткий, а вложенный попап
            внутри Dialog хуже ведёт себя на телефоне. */}
        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Тегов пока нет — создайте их на странице тегов.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <TagToggle
                key={t.id}
                tag={t}
                selected={tagIds.includes(t.id)}
                onToggle={() =>
                  setValue(
                    "tag_ids",
                    tagIds.includes(t.id)
                      ? tagIds.filter((id) => id !== t.id)
                      : [...tagIds, t.id],
                  )
                }
              />
            ))}
          </div>
        )}
      </div>
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
