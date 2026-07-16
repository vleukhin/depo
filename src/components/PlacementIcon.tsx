import { cn } from "@/lib/utils";
import { PLACEMENT_ICONS, type PlacementIconId } from "@/types";

// Настоящие логотипы брендов (официальные SVG-марки). Используются для пометки
// размещения соответствующего сервиса. Каждая иконка — самодостаточный <svg>
// со своим viewBox; размер задаётся через className на компоненте PlacementIcon.

const base = "inline-block shrink-0";

type IconDef = { label: string; svg: (cls?: string) => React.ReactNode };

export const PLACEMENT_ICON_META: Record<PlacementIconId, IconDef> = {
  kucoin: {
    label: "KuCoin",
    svg: (cls) => (
      <svg viewBox="0 0 24 24" role="img" aria-label="KuCoin" className={cn(base, cls)}>
        <path
          fill="#23AF91"
          d="m7.928 11.996 7.122 7.122 4.49-4.49a2.004 2.004 0 0 1 2.865 0 2.004 2.004 0 0 1 0 2.865l-5.918 5.918a2.058 2.058 0 0 1-2.883 0l-8.541-8.542v5.07a2.034 2.034 0 1 1-4.07 0V4.043a2.034 2.034 0 1 1 4.07 0v5.088L13.604.589a2.058 2.058 0 0 1 2.883 0l5.918 5.918c.785.803.785 2.088 0 2.865-.804.785-2.089.785-2.865 0l-4.49-4.49zM15.05 9.96a2.038 2.038 0 0 0-2.053 2.035c0 1.133.902 2.052 2.035 2.052a2.038 2.038 0 0 0 2.053-2.035v-.018a2.07 2.07 0 0 0-2.035-2.034z"
        />
      </svg>
    ),
  },
  bitget: {
    label: "Bitget",
    svg: (cls) => (
      <svg viewBox="0 0 40 40" role="img" aria-label="Bitget" className={cn(base, cls)}>
        <rect width="40" height="40" rx="8.71" fill="#00F0FF" />
        <path
          fill="#1B1B1B"
          d="m18.4596 15.7671h7.4686l7.6404 7.5916c.497.4938.4996 1.2971.0051 1.7934L23.7753 35h-7.6937l2.326-2.2613 8.54-8.4861-8.4316-8.4862"
        />
        <path
          fill="#1B1B1B"
          d="m21.5292 24.2336h-7.4686l-7.6404-7.5917c-.497-.4938-.4996-1.297-.0051-1.7934L16.2135 5h7.6937l-2.326 2.2613-8.54 8.4861 8.4316 8.4862"
        />
      </svg>
    ),
  },
  onekey: {
    label: "OneKey",
    svg: (cls) => (
      <svg viewBox="0 0 65 64" role="img" aria-label="OneKey" className={cn(base, cls)}>
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          fill="#16D629"
          d="M32.5 64C54.5914 64 64.5 54.0914 64.5 32C64.5 9.90862 54.5914 0 32.5 0C10.4086 0 0.5 9.90862 0.5 32C0.5 54.0914 10.4086 64 32.5 64ZM35.3857 13.5696H26.4834L24.9217 18.292H29.8662V28.2395H35.3857V13.5696ZM42.6504 40.2785C42.6504 45.8856 38.105 50.4311 32.4979 50.4311C26.8908 50.4311 22.3453 45.8856 22.3453 40.2785C22.3453 34.6714 26.8908 30.126 32.4979 30.126C38.105 30.126 42.6504 34.6714 42.6504 40.2785ZM38.0413 40.2785C38.0413 43.3401 35.5594 45.822 32.4978 45.822C29.4363 45.822 26.9544 43.3401 26.9544 40.2785C26.9544 37.217 29.4363 34.735 32.4978 34.735C35.5594 34.735 38.0413 37.217 38.0413 40.2785Z"
        />
      </svg>
    ),
  },
  tangem: {
    label: "Tangem",
    // Только фирменная марка (три квадрата) из логотипа-словомарки Tangem.
    // currentColor — чёрная в светлой теме, белая в тёмной, как в оригинале.
    svg: (cls) => (
      <svg viewBox="0 0 14.6 18.9" role="img" aria-label="Tangem" className={cn(base, cls)}>
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M3.414.82h7.576c1.195 0 1.792 0 2.249.233.402.203.727.53.932.931.233.457.233 1.054.233 2.249V5.5H0V4.233c0-1.195 0-1.792.233-2.249.203-.401.53-.727.932-.931C1.622.82 2.219.82 3.414.82m10.991 8.64H9.603l.002.665v8.695h1.386c1.195 0 1.792 0 2.25-.233.4-.203.726-.53.931-.931.233-.457.233-1.054.233-2.25zM4.8 9.82H0v5.947c0 1.195 0 1.792.233 2.249.205.401.53.728.932.931.457.233 1.054.233 2.249.233H4.8z"
        />
      </svg>
    ),
  },
};

// Порядок иконок в выпадающем списке — как в PLACEMENT_ICONS.
export const PLACEMENT_ICON_OPTIONS = PLACEMENT_ICONS.map((id) => ({
  id,
  label: PLACEMENT_ICON_META[id].label,
}));

/** Логотип бренда для размещения. Размер задаётся через className (напр. `size-5`). */
export function PlacementIcon({
  icon,
  className,
}: {
  icon: PlacementIconId;
  className?: string;
}) {
  return PLACEMENT_ICON_META[icon].svg(className);
}
