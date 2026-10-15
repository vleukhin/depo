"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, GitCompareArrows, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSnapshots } from "@/hooks/useSnapshots";

/** Сколько снимков показывать в списке: автоснимки копятся каждый день. */
const LIMIT = 10;

const CURRENT_LABEL = "Текущее состояние";

/**
 * Выбор, с чем сравнить снимок: текущее депо или другой снимок (поиск по дате
 * и комментарию, в списке не больше LIMIT снимков). Выбор ведёт на
 * /snapshots/[id]/compare?with=…; `value` — текущая цель на странице сравнения.
 */
export function CompareSelect({ id, value }: { id: number; value?: string }) {
  const router = useRouter();
  const { data: snapshots = [] } = useSnapshots();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Дату ищем в том же виде, в каком она показана: «13.10.2026, 21:00».
  const options = useMemo(
    () =>
      snapshots
        .filter((s) => s.id !== id)
        .map((s) => ({
          value: String(s.id),
          date: formatDateTime(s.created_at),
          comment: s.comment,
        })),
    [snapshots, id],
  );

  const q = query.trim().toLowerCase();
  const matches = q
    ? options.filter((o) => `${o.date} ${o.comment ?? ""}`.toLowerCase().includes(q))
    : options;
  const shown = matches.slice(0, LIMIT);
  const showCurrent = !q || CURRENT_LABEL.toLowerCase().includes(q);

  const selected = options.find((o) => o.value === value);
  const label =
    value === "current" ? CURRENT_LABEL : selected ? selected.date : "Сравнить с…";

  function pick(v: string) {
    setOpen(false);
    setQuery("");
    router.push(`/snapshots/${id}/compare?with=${v}`);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("max-w-full font-normal", !value && "text-muted-foreground")}
        >
          <GitCompareArrows className="size-4" />
          <span className="truncate">{label}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-1">
        <div className="relative p-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              // Enter — первый вариант из списка, как в обычном комбобоксе.
              if (e.key !== "Enter") return;
              const first = showCurrent ? "current" : shown[0]?.value;
              if (first) pick(first);
            }}
            placeholder="Дата или комментарий"
            className="h-8 pl-8"
          />
        </div>
        <ul className="mt-1">
          {showCurrent && (
            <Option active={value === "current"} onSelect={() => pick("current")}>
              {CURRENT_LABEL}
            </Option>
          )}
          {showCurrent && shown.length > 0 && <li className="my-1 h-px bg-border" aria-hidden />}
          {shown.map((o) => (
            <Option key={o.value} active={o.value === value} onSelect={() => pick(o.value)}>
              <span className="tabular-nums">{o.date}</span>
              {o.comment && <span className="truncate text-muted-foreground">{o.comment}</span>}
            </Option>
          ))}
          {!showCurrent && shown.length === 0 && (
            <li className="px-2 py-3 text-center text-sm text-muted-foreground">
              Ничего не найдено
            </li>
          )}
        </ul>
        {matches.length > LIMIT && (
          <p className="border-t px-2 pt-1.5 pb-1 text-xs text-muted-foreground">
            Показаны {LIMIT} из {matches.length} — уточните поиск
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}

function Option({
  active,
  onSelect,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
        {active && <Check className="size-4 shrink-0" />}
      </button>
    </li>
  );
}
