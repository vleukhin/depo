import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TAG_COLORS, type Tag, type TagColor } from "@/types";

// Классы перечислены целиком, без интерполяции: Tailwind собирает только те,
// что встречаются в исходниках буквально.
const TAG_COLOR_CLASS: Record<TagColor, string> = {
  violet: "bg-[var(--tag-violet)] text-[var(--tag-violet-fg)]",
  indigo: "bg-[var(--tag-indigo)] text-[var(--tag-indigo-fg)]",
  blue: "bg-[var(--tag-blue)] text-[var(--tag-blue-fg)]",
  teal: "bg-[var(--tag-teal)] text-[var(--tag-teal-fg)]",
  green: "bg-[var(--tag-green)] text-[var(--tag-green-fg)]",
  amber: "bg-[var(--tag-amber)] text-[var(--tag-amber-fg)]",
  orange: "bg-[var(--tag-orange)] text-[var(--tag-orange-fg)]",
  red: "bg-[var(--tag-red)] text-[var(--tag-red-fg)]",
  pink: "bg-[var(--tag-pink)] text-[var(--tag-pink-fg)]",
  slate: "bg-[var(--tag-slate)] text-[var(--tag-slate-fg)]",
};

const TAG_DOT_CLASS: Record<TagColor, string> = {
  violet: "bg-[var(--tag-violet-fg)]",
  indigo: "bg-[var(--tag-indigo-fg)]",
  blue: "bg-[var(--tag-blue-fg)]",
  teal: "bg-[var(--tag-teal-fg)]",
  green: "bg-[var(--tag-green-fg)]",
  amber: "bg-[var(--tag-amber-fg)]",
  orange: "bg-[var(--tag-orange-fg)]",
  red: "bg-[var(--tag-red-fg)]",
  pink: "bg-[var(--tag-pink-fg)]",
  slate: "bg-[var(--tag-slate-fg)]",
};

// Подписи цветов для доступности (aria-label кружков в форме тега).
const TAG_COLOR_LABELS: Record<TagColor, string> = {
  violet: "Фиолетовый",
  indigo: "Индиго",
  blue: "Синий",
  teal: "Бирюзовый",
  green: "Зелёный",
  amber: "Янтарный",
  orange: "Оранжевый",
  red: "Красный",
  pink: "Розовый",
  slate: "Серый",
};

export { TAG_COLOR_LABELS };

/** Цветной кружок — для палитры в форме тега и для невыбранных чипов. */
export function TagDot({ color, className }: { color: TagColor; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", TAG_DOT_CLASS[color], className)}
    />
  );
}

/** Чип тега. size="sm" — для компактных мобильных карточек; children — иконка справа. */
export function TagBadge({
  tag,
  size = "default",
  className,
  children,
}: {
  tag: Tag;
  size?: "sm" | "default";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Badge
      className={cn(
        TAG_COLOR_CLASS[tag.color],
        size === "sm" && "h-4 px-1.5 text-[10px]",
        "max-w-full truncate",
        className,
      )}
      title={tag.name}
    >
      {tag.name}
      {children}
    </Badge>
  );
}

/** Переключаемый чип: выбран — залит цветом, нет — контурный с цветной точкой. */
export function TagToggle({
  tag,
  selected,
  onToggle,
}: {
  tag: Tag;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      aria-label={tag.name}
      className="max-w-full"
    >
      <Badge
        variant={selected ? "default" : "outline"}
        className={cn(
          "cursor-pointer max-w-full truncate",
          selected ? TAG_COLOR_CLASS[tag.color] : "text-muted-foreground hover:bg-muted",
        )}
      >
        {!selected && <TagDot color={tag.color} />}
        {tag.name}
      </Badge>
    </button>
  );
}

/** Палитра цветов для формы тега. */
export function TagColorPicker({
  value,
  onChange,
}: {
  value: TagColor;
  onChange: (color: TagColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TAG_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-pressed={color === value}
          aria-label={TAG_COLOR_LABELS[color]}
          title={TAG_COLOR_LABELS[color]}
          className={cn(
            "flex size-7 items-center justify-center rounded-full transition-all",
            TAG_COLOR_CLASS[color],
            color === value
              ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
              : "opacity-70 hover:opacity-100",
          )}
        >
          {color === value && <Check className="size-4" />}
        </button>
      ))}
    </div>
  );
}
