"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ArchivePage } from "@/types";

/** Число страниц архива (минимум одна — пустой архив тоже страница). */
export function pageCount(data: ArchivePage<unknown>): number {
  return Math.max(1, Math.ceil(data.total / data.page_size));
}

/** Навигация по страницам архива; скрыта, если всё помещается на одну страницу. */
export function ArchivePagination({
  data,
  onPageChange,
}: {
  data: ArchivePage<unknown> | undefined;
  onPageChange: (page: number) => void;
}) {
  if (!data || data.total <= data.page_size) return null;
  const { page, page_size, total } = data;
  const pages = pageCount(data);
  const from = (page - 1) * page_size + 1;
  const to = Math.min(page * page_size, total);

  function go(next: number) {
    onPageChange(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <nav
      aria-label="Страницы архива"
      className="mt-4 flex items-center justify-between gap-2 text-sm text-muted-foreground"
    >
      <span className="tabular-nums">
        {from}–{to} из {total}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Предыдущая страница"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <span className="tabular-nums px-1">
          {page} / {pages}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Следующая страница"
          disabled={page >= pages}
          onClick={() => go(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
