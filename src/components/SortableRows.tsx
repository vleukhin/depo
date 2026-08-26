"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

/**
 * DnD-контекст для строк таблицы; onReorder получает полный новый порядок id.
 * disabled нужен, когда список отфильтрован: reorder переписывает sort_order
 * позицией в массиве, так что перетаскивание подмножества испортило бы порядок.
 */
export function SortableRows({
  ids,
  onReorder,
  disabled,
  children,
}: {
  ids: number[];
  onReorder: (ids: number[]) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (disabled || !over || active.id === over.id) return;
    const from = ids.indexOf(Number(active.id));
    const to = ids.indexOf(Number(over.id));
    if (from !== -1 && to !== -1) onReorder(arrayMove(ids, from, to));
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

/** Строка таблицы с ручкой перетаскивания в первой ячейке. */
export function SortableRow({
  id,
  disabled,
  children,
}: {
  id: number;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "relative z-10 opacity-60 bg-muted")}
    >
      <TableCell className="w-8 pr-0">
        {/* При disabled ручка остаётся на месте (колонки не съезжают), но не тянется. */}
        <button
          type="button"
          aria-label="Переместить"
          disabled={disabled}
          title={disabled ? "Порядок не меняется, пока активен фильтр" : undefined}
          className={cn(
            "text-muted-foreground/60 touch-none",
            disabled
              ? "cursor-default opacity-40"
              : "cursor-grab active:cursor-grabbing hover:text-muted-foreground",
          )}
          {...(disabled ? {} : attributes)}
          {...(disabled ? {} : listeners)}
        >
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      {children}
    </TableRow>
  );
}

/**
 * Мобильный аналог SortableRow: компактная карточка-`<li>` с тонкой ручкой
 * перетаскивания слева (на всю высоту карточки — удобная зона захвата).
 */
export function SortableCard({
  id,
  disabled,
  children,
  className,
}: {
  id: number;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id, disabled });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-stretch gap-1 rounded-lg ring-1 ring-foreground/10 bg-card shadow-card py-1.5 pr-1.5 pl-1",
        isDragging && "relative z-10 opacity-60 shadow-raised",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Переместить"
        disabled={disabled}
        className={cn(
          "flex w-7 shrink-0 items-center justify-center self-stretch rounded-md text-muted-foreground/50 touch-none",
          disabled
            ? "cursor-default opacity-40"
            : "cursor-grab active:cursor-grabbing hover:text-muted-foreground",
        )}
        {...(disabled ? {} : attributes)}
        {...(disabled ? {} : listeners)}
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0 flex-1">{children}</div>
    </li>
  );
}
