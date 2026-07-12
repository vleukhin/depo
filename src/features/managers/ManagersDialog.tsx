"use client";

import { useState } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/DeleteButton";
import { useDeleteManager, useManagers } from "@/hooks/useManagers";
import type { Manager } from "@/types";
import { ManagerForm } from "./ManagerForm";

/** @nick или nick -> https://t.me/nick */
function telegramUrl(nick: string): string {
  return `https://t.me/${nick.trim().replace(/^@/, "")}`;
}

function TelegramCell({ telegram }: { telegram: string | null }) {
  if (!telegram) return <span className="text-muted-foreground">—</span>;
  const handle = telegram.trim().replace(/^@/, "");
  return (
    <a
      href={telegramUrl(telegram)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 hover:text-foreground hover:underline underline-offset-2"
      title="Открыть в Telegram"
    >
      <span>@{handle}</span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

export function ManagersDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: managers = [], isLoading } = useManagers();
  const del = useDeleteManager();
  const [editing, setEditing] = useState<Manager | undefined>(undefined);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setEditing(undefined);
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Менеджеры</DialogTitle>
          <DialogDescription>Справочник для выбора в долгах</DialogDescription>
        </DialogHeader>

        {/* Инлайн-форма add/edit; key перемонтирует её при смене редактируемой строки. */}
        <ManagerForm
          key={editing?.id ?? "new"}
          manager={editing}
          onDone={() => setEditing(undefined)}
          onCancel={() => setEditing(undefined)}
        />

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Имя</TableHead>
              <TableHead>Telegram</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {managers.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  <TelegramCell telegram={m.telegram} />
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Изменить"
                    onClick={() => setEditing(m)}
                  >
                    <Pencil className="size-4 text-muted-foreground" />
                  </Button>
                  <DeleteButton
                    description="Менеджера можно удалить, только если у него нет связанных долгов."
                    onConfirm={() => del.mutateAsync(m.id)}
                  />
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && managers.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  Пока нет менеджеров
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
