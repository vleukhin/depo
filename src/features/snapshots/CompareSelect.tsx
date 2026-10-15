"use client";

import { useRouter } from "next/navigation";
import { GitCompareArrows } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import { useSnapshots } from "@/hooks/useSnapshots";

/**
 * Выбор, с чем сравнить снимок: текущее депо или другой снимок.
 * Выбор ведёт на /snapshots/[id]/compare?with=…; `value` — текущая цель на странице сравнения.
 */
export function CompareSelect({ id, value }: { id: number; value?: string }) {
  const router = useRouter();
  const { data: snapshots = [] } = useSnapshots();
  const others = snapshots.filter((s) => s.id !== id);

  return (
    <Select
      value={value}
      onValueChange={(v) => router.push(`/snapshots/${id}/compare?with=${v}`)}
    >
      <SelectTrigger size="sm" className="max-w-full">
        <GitCompareArrows className="size-4" />
        <SelectValue placeholder="Сравнить с…" />
      </SelectTrigger>
      <SelectContent position="popper" align="start">
        <SelectItem value="current">Текущее состояние</SelectItem>
        {others.length > 0 && <SelectSeparator />}
        {others.map((s) => (
          <SelectItem key={s.id} value={String(s.id)}>
            <span className="tabular-nums">{formatDateTime(s.created_at)}</span>
            {s.comment && (
              <span className="max-w-48 truncate text-muted-foreground">{s.comment}</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
