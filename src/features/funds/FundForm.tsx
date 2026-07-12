"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { fundInput, type FundFormValues, type FundInput } from "@/lib/validate";
import { useCreateFund, useUpdateFund } from "@/hooks/useFunds";
import type { Fund } from "@/types";

export function FundForm({ fund, onDone }: { fund?: Fund; onDone: () => void }) {
  const create = useCreateFund();
  const update = useUpdateFund();
  const {
    register,
    handleSubmit,
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
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Название</Label>
        <Input id="name" placeholder="Напр. Личные средства" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="amount">Сумма, USDT</Label>
        <Input
          id="amount"
          type="number"
          step="1"
          min="0"
          placeholder="0"
          {...register("amount", { valueAsNumber: true })}
        />
        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
      </div>
      <DialogFooter>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Сохранение…" : "Сохранить"}
        </Button>
      </DialogFooter>
    </form>
  );
}
