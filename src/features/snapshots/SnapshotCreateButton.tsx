"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCreateSnapshot } from "@/hooks/useSnapshots";

/** Кнопка «Сделать снимок»: диалог с необязательным комментарием.
 *  iconOnly — компактный вариант для шапки сайта. */
export function SnapshotCreateButton({ iconOnly = false }: { iconOnly?: boolean }) {
  const create = useCreateSnapshot();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");

  async function submit() {
    try {
      await create.mutateAsync({ comment: comment.trim() || null });
      toast.success("Снимок сохранён");
      setOpen(false);
      setComment("");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <>
      {iconOnly ? (
        <Button
          variant="ghost"
          size="icon"
          aria-label="Сделать снимок депо"
          title="Сделать снимок депо"
          onClick={() => setOpen(true)}
        >
          <Camera className="size-4" />
        </Button>
      ) : (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Camera className="size-4" />
          Сделать снимок
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Сделать снимок депо</DialogTitle>
            <DialogDescription>
              Сохранит текущее состояние всех блоков: средства, размещения и долги. Снимок можно
              будет посмотреть на странице снимков.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="snapshot-comment">Комментарий (необязательно)</Label>
            <Textarea
              id="snapshot-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Например: перед выводом средств"
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button onClick={submit} disabled={create.isPending}>
              {create.isPending ? "Сохранение…" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
