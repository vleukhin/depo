"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TagColorPicker } from "@/components/TagBadge";
import { tagInput, type TagFormValues, type TagInput } from "@/lib/validate";
import { useCreateTag, useUpdateTag } from "@/hooks/useTags";
import type { Tag, TagColor } from "@/types";

export function TagForm({
  tag,
  onDone,
  onCancel,
}: {
  tag?: Tag;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const create = useCreateTag();
  const update = useUpdateTag();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<TagFormValues, unknown, TagInput>({
    resolver: zodResolver(tagInput),
    defaultValues: {
      name: tag?.name ?? "",
      color: tag?.color ?? "violet",
    },
  });

  const color = watch("color") ?? "violet";
  const submitting = create.isPending || update.isPending;

  async function onSubmit(values: TagInput) {
    try {
      if (tag) await update.mutateAsync({ id: tag.id, input: values });
      else await create.mutateAsync(values);
      toast.success(tag ? "Изменения сохранены" : "Тег добавлен");
      reset({ name: "", color: "violet" }); // очистить форму под следующий ввод
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
    >
      <div className="space-y-1 sm:w-56">
        <Label htmlFor="t-name" className="text-xs text-muted-foreground">
          Название
        </Label>
        <Input id="t-name" placeholder="Напр. Холодные" {...register("name")} />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>
      <div className="space-y-1 sm:flex-1">
        <Label className="text-xs text-muted-foreground">Цвет</Label>
        <TagColorPicker value={color} onChange={(c: TagColor) => setValue("color", c)} />
      </div>
      <div className="flex items-center gap-1 sm:pt-[1.375rem]">
        <Button type="submit" size="sm" disabled={submitting}>
          {tag ? "Сохранить" : "Добавить"}
        </Button>
        {tag && onCancel && (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  );
}
