"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CalendarIcon } from "lucide-react";
import { ru } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlacements } from "@/hooks/usePlacements";
import { useCreateDebt, useUpdateDebt } from "@/hooks/useDebts";
import { formatDate } from "@/lib/format";
import { SERVICES, type Debt, type Service } from "@/types";
import type { DebtInput } from "@/lib/validate";

const NONE = "__none__";
const TEXT = "__text__";

/** "2026-07-12" -> Date в локальном поясе (без сдвига на UTC). */
function parseYmd(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date -> "2026-07-12" в локальном поясе. */
function toYmd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Валидируются только текстовые поля; сервис и источник — через локальное состояние.
const formSchema = z.object({
  manager: z.string().trim().min(1, "Укажите менеджера"),
  amount: z.number({ message: "Укажите сумму" }).min(0, "Сумма не может быть отрицательной"),
  source_text: z.string().trim().optional(),
  comment: z.string().trim().optional(),
});
type FormValues = z.infer<typeof formSchema>;

type SourceKind = "none" | "placement" | "text";

export function DebtForm({ debt, onDone }: { debt?: Debt; onDone: () => void }) {
  const { data: placements = [] } = usePlacements();
  const create = useCreateDebt();
  const update = useUpdateDebt();

  // По умолчанию — сегодняшняя дата.
  const [date, setDate] = useState<Date>(() => (debt?.date ? parseYmd(debt.date) : new Date()));
  const [dateOpen, setDateOpen] = useState(false);
  const [service, setService] = useState<Service | "">(debt?.service ?? "");
  const [sourceKind, setSourceKind] = useState<SourceKind>(
    debt?.placement_id ? "placement" : debt?.source_text ? "text" : "none",
  );
  const [placementId, setPlacementId] = useState<string>(
    debt?.placement_id ? String(debt.placement_id) : "",
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      manager: debt?.manager ?? "",
      amount: debt?.amount ?? 0,
      source_text: debt?.source_text ?? "",
      comment: debt?.comment ?? "",
    },
  });

  const submitting = create.isPending || update.isPending;

  // Значение единого селекта источника.
  const sourceValue = sourceKind === "placement" ? placementId : sourceKind === "text" ? TEXT : NONE;
  function onSourceChange(value: string) {
    if (value === NONE) setSourceKind("none");
    else if (value === TEXT) setSourceKind("text");
    else {
      setSourceKind("placement");
      setPlacementId(value);
    }
  }

  async function onSubmit(values: FormValues) {
    const input: DebtInput = {
      manager: values.manager,
      amount: values.amount,
      date: toYmd(date),
      service: service || null,
      placement_id: sourceKind === "placement" ? Number(placementId) : null,
      source_text: sourceKind === "text" ? values.source_text?.trim() || null : null,
      comment: values.comment?.trim() || null,
    };
    try {
      if (debt) await update.mutateAsync({ id: debt.id, input });
      else await create.mutateAsync(input);
      toast.success(debt ? "Изменения сохранены" : "Долг добавлен");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="d-manager">Менеджер</Label>
          <Input id="d-manager" placeholder="Кто взял" {...register("manager")} />
          {errors.manager && <p className="text-sm text-destructive">{errors.manager.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="d-amount">Сумма, USDT</Label>
          <Input
            id="d-amount"
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
          <Label>Дата</Label>
          <Popover open={dateOpen} onOpenChange={setDateOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start font-normal"
              >
                <CalendarIcon className="size-4 text-muted-foreground" />
                {formatDate(date)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(d) => {
                  if (d) {
                    setDate(d);
                    setDateOpen(false);
                  }
                }}
                defaultMonth={date}
                locale={ru}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Сервис</Label>
          <Select
            value={service || NONE}
            onValueChange={(v) => setService(v === NONE ? "" : (v as Service))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>— не указан —</SelectItem>
              {SERVICES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Откуда взял</Label>
        <Select value={sourceValue} onValueChange={onSourceChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Выберите источник" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>— не указан —</SelectItem>
            {placements.map((p) => (
              <SelectItem key={p.id} value={String(p.id)}>
                {p.name}
              </SelectItem>
            ))}
            <SelectItem value={TEXT}>Свободный текст…</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sourceKind === "text" && (
        <div className="space-y-2">
          <Label htmlFor="d-source-text">Источник (текст)</Label>
          <Input
            id="d-source-text"
            placeholder="Напр. наличные, другой депозит"
            {...register("source_text")}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="d-comment">Комментарий</Label>
        <Textarea id="d-comment" rows={2} {...register("comment")} />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Сохранение…" : "Сохранить"}
        </Button>
      </DialogFooter>
    </form>
  );
}
