"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UsdtIcon } from "@/components/UsdtAmount";
import { fundInput, type FundFormValues, type FundInput } from "@/lib/validate";
import { useCreateFund, useUpdateFund } from "@/hooks/useFunds";
import type { Fund } from "@/types";

/** Инлайн-форма add/edit средства (по образцу ManagerForm) — живёт в FundsDialog. */
export function FundForm({
  fund,
  onDone,
  onCancel,
}: {
  fund?: Fund;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const create = useCreateFund();
  const update = useUpdateFund();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FundFormValues, unknown, FundInput>({
    resolver: zodResolver(fundInput),
    defaultValues: { name: fund?.name ?? "", amount: fund?.amount ?? 0 },
  });

  const submitting = create.isPending || update.isPending;

  async function onSubmit(values: FundInput) {
    try {
      if (fund) await update.mutateAsync({ id: fund.id, input: values });
      else await create.mutateAsync(values);
      toast.success(fund ? "Изменения сохранены" : "Средство добавлено");
      reset({ name: "", amount: 0 }); // очистить форму под следующий ввод
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex items-start gap-2">
      <div className="flex-1 space-y-1">
        <Label htmlFor="f-name" className="text-xs text-muted-foreground">
          Название
        </Label>
        <Input id="f-name" placeholder="Напр. Личные средства" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="w-32 space-y-1">
        <Label htmlFor="f-amount" className="gap-1 text-xs text-muted-foreground">
          Сумма, <UsdtIcon className="size-3" />
        </Label>
        <Input
          id="f-amount"
          type="number"
          step="1"
          min="0"
          placeholder="0"
          {...register("amount", { valueAsNumber: true })}
        />
        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
      </div>
      <div className="flex items-center gap-1 pt-[1.375rem]">
        <Button type="submit" size="sm" disabled={submitting}>
          {fund ? "Сохранить" : "Добавить"}
        </Button>
        {fund && onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  );
}
