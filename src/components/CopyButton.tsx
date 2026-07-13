"use client";

import { useState, type MouseEvent } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Кнопка-иконка «скопировать в буфер»: на успех ненадолго показывает галочку + тост. */
export function CopyButton({
  value,
  label = "Скопировать",
  successMessage = "Скопировано",
  className,
}: {
  value: string;
  label?: string;
  successMessage?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy(e: MouseEvent) {
    e.stopPropagation(); // строки таблицы кликабельны/перетаскиваемы — не даём событию всплыть
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-6", className)}
      aria-label={label}
      title={label}
      onClick={copy}
    >
      {copied ? (
        <Check className="size-3.5 text-emerald-500" />
      ) : (
        <Copy className="size-3.5 text-muted-foreground" />
      )}
    </Button>
  );
}
