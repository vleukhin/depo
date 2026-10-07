// Общие куски попапа пополнения газа: вкладка биржи и вкладка TronRental.

import { ExternalLink } from "lucide-react";
import { Label } from "@/components/ui/label";
import { explorerAddressUrl, isChainAddress } from "@/lib/chains";
import type { Placement } from "@/types";

// Локальный форматтер: точные суммы с группировкой (в отличие от таблицы, где
// баланс округляется) — на экране вывода важна точность до последнего знака.
// Восьми знаков хватает и на минимум, и на комиссию биржи (у них бывает больше
// шести); дальше упираемся в мусор двоичного представления, а не в данные.
export const coinFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 8 });

/** Адрес получателя записи — ссылкой в обозреватель, если формат валиден. */
export function RecipientAddress({ placement }: { placement: Placement }) {
  const { chain } = placement;
  const address = placement.address ?? "";
  return (
    <div className="space-y-1">
      <Label>Адрес получателя</Label>
      {isChainAddress(chain, address) ? (
        <a
          href={explorerAddressUrl(chain, address)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2"
        >
          <span className="break-all">{address}</span>
          <ExternalLink className="size-3 shrink-0" />
        </a>
      ) : (
        <p className="font-mono text-xs text-muted-foreground break-all">{address}</p>
      )}
    </div>
  );
}

/** Строка «подпись — значение» на шаге подтверждения. */
export function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
