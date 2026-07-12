"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import {
  placementInput,
  type PlacementFormValues,
  type PlacementInput,
} from "@/lib/validate";
import { useCreatePlacement, useUpdatePlacement } from "@/hooks/usePlacements";
import type { Placement } from "@/types";

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
    formState: { errors },
  } = useForm<PlacementFormValues, unknown, PlacementInput>({
    resolver: zodResolver(placementInput),
    defaultValues: {
      name: placement?.name ?? "",
      amount: placement?.amount ?? 0,
      place: placement?.place ?? "",
      address: placement?.address ?? "",
      comment: placement?.comment ?? "",
    },
  });

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
          <Label htmlFor="p-amount">Сумма, USDT</Label>
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
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="p-place">Место / платформа</Label>
          <Input id="p-place" placeholder="Напр. CEX, кошелёк" {...register("place")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="p-address">Адрес</Label>
          <Input id="p-address" placeholder="Адрес кошелька / счёта" {...register("address")} />
        </div>
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
