"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/DeleteButton";
import { TagBadge } from "@/components/TagBadge";
import { useDeleteTag, useTags } from "@/hooks/useTags";
import type { Tag } from "@/types";
import { TagForm } from "./TagForm";

/** «1 запись» / «2 записи» / «5 записей». */
function usageLabel(count: number): string {
  if (count === 0) return "не используется";
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} запись`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} записи`;
  return `${count} записей`;
}

export function TagsManager() {
  const { data: tags = [], isLoading } = useTags();
  const del = useDeleteTag();
  const [editing, setEditing] = useState<Tag | undefined>(undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Справочник тегов</CardTitle>
        <CardDescription>
          Теги можно навесить на любую запись свободных средств и фильтровать по ним список
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Инлайн-форма add/edit; key перемонтирует её при смене редактируемой строки. */}
        <TagForm
          key={editing?.id ?? "new"}
          tag={editing}
          onDone={() => setEditing(undefined)}
          onCancel={() => setEditing(undefined)}
        />

        {/* Один список на все разрешения: чип + счётчик + действия помещаются и на телефоне. */}
        <ul className="space-y-2">
          {tags.map((t) => (
            <li
              key={t.id}
              className="flex items-center gap-2 rounded-lg ring-1 ring-foreground/10 bg-card shadow-card px-3 py-2"
            >
              <TagBadge tag={t} />
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {usageLabel(t.usage_count)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                aria-label="Изменить"
                onClick={() => setEditing(t)}
              >
                <Pencil className="size-4 text-muted-foreground" />
              </Button>
              <DeleteButton
                className="size-8 shrink-0"
                description={
                  t.usage_count > 0
                    ? `Тег будет снят с записей (${usageLabel(t.usage_count)}) и удалён без возможности восстановления.`
                    : "Тег будет удалён без возможности восстановления."
                }
                onConfirm={() => del.mutateAsync(t.id)}
              />
            </li>
          ))}
          {!isLoading && tags.length === 0 && (
            <li className="rounded-lg ring-1 ring-foreground/10 bg-card shadow-card px-3 py-4 text-center text-sm text-muted-foreground">
              Пока нет тегов
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
