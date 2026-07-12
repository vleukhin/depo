"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  managerInput,
  type ManagerFormValues,
  type ManagerInput,
} from "@/lib/validate";
import { useCreateManager, useUpdateManager } from "@/hooks/useManagers";
import type { Manager } from "@/types";

export function ManagerForm({
  manager,
  onDone,
  onCancel,
}: {
  manager?: Manager;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const create = useCreateManager();
  const update = useUpdateManager();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ManagerFormValues, unknown, ManagerInput>({
    resolver: zodResolver(managerInput),
    defaultValues: {
      name: manager?.name ?? "",
      telegram: manager?.telegram ?? "",
    },
  });

  const submitting = create.isPending || update.isPending;

  async function onSubmit(values: ManagerInput) {
    try {
      if (manager) await update.mutateAsync({ id: manager.id, input: values });
      else await create.mutateAsync(values);
      toast.success(manager ? "Изменения сохранены" : "Менеджер добавлен");
      reset({ name: "", telegram: "" }); // очистить форму под следующий ввод
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex items-start gap-2">
      <div className="flex-1 space-y-1">
        <Label htmlFor="m-name" className="text-xs text-muted-foreground">
          Имя
        </Label>
        <Input id="m-name" placeholder="Имя менеджера" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="flex-1 space-y-1">
        <Label htmlFor="m-telegram" className="text-xs text-muted-foreground">
          Telegram
        </Label>
        <Input id="m-telegram" placeholder="@nickname" {...register("telegram")} />
      </div>
      <div className="flex items-center gap-1 pt-[1.375rem]">
        <Button type="submit" size="sm" disabled={submitting}>
          {manager ? "Сохранить" : "Добавить"}
        </Button>
        {manager && onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  );
}
