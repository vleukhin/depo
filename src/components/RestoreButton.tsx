"use client";

import { ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** Восстановление записи из архива. Без подтверждения — действие неразрушающее. */
export function RestoreButton({
  onConfirm,
  className,
}: {
  onConfirm: () => Promise<unknown>;
  className?: string;
}) {
  async function handle() {
    try {
      await onConfirm();
      toast.success("Запись восстановлена");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Восстановить"
      title="Восстановить из архива"
      className={className}
      onClick={handle}
    >
      <ArchiveRestore className="size-4 text-muted-foreground" />
    </Button>
  );
}
