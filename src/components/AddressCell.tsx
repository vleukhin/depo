"use client";

import { CopyButton } from "@/components/CopyButton";
import { isTronAddress } from "@/lib/tron";

// Адрес целиком; первые и последние 6 символов выделены на фоне приглушённой середины.
function AddressText({ value }: { value: string }) {
  if (value.length <= 12) {
    return <span className="text-foreground font-semibold">{value}</span>;
  }
  return (
    <span className="whitespace-nowrap">
      <span className="text-foreground font-semibold">{value.slice(0, 6)}</span>
      {value.slice(6, -6)}
      <span className="text-foreground font-semibold">{value.slice(-6)}</span>
    </span>
  );
}

/** Адрес размещения: ссылка в Tronscan (для TRON-адресов) + кнопка копирования. */
export function AddressCell({ address }: { address: string | null }) {
  if (!address) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1">
      {isTronAddress(address) ? (
        <a
          href={`https://tronscan.org/#/address/${address.trim()}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="hover:underline underline-offset-2"
          title="Открыть в Tronscan"
        >
          <AddressText value={address} />
        </a>
      ) : (
        <AddressText value={address} />
      )}
      <CopyButton value={address} label="Скопировать адрес" successMessage="Адрес скопирован" />
    </span>
  );
}
