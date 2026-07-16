import { cn } from "@/lib/utils";
import type { Service } from "@/types";

// Фавиконки/фирменные марки сервисов-обменников (файлы в public/services).
// Для Lets и Currex — их собственные фавиконки (png), для Mate и N-Obmen —
// вырезанная из логотипа-словомарки квадратная эмблема (svg).
const SERVICE_ICON_SRC: Record<Service, string> = {
  Lets: "/services/lets.png",
  Mate: "/services/mate.svg",
  "N-Obmen": "/services/n-obmen.svg",
  Currex: "/services/currex.png",
};

/**
 * Иконка сервиса на белой «плашке» — так тёмные марки (напр. Lets) остаются
 * читаемыми и в тёмной теме, а разнородные логотипы выглядят единообразно.
 * Размер задаётся через className (напр. `size-5`).
 */
export function ServiceIcon({
  service,
  className,
}: {
  service: Service;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-white p-0.5 ring-1 ring-black/5",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={SERVICE_ICON_SRC[service]}
        alt=""
        aria-hidden
        className="size-full object-contain"
      />
    </span>
  );
}
