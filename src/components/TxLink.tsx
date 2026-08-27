import { ExternalLink } from "lucide-react";
import { CHAIN_META, explorerTxUrl } from "@/lib/chains";
import type { Chain } from "@/types";

/** Иконка-ссылка на транзакцию в обозревателе сети. Ничего не рендерит, если хэша нет. */
export function TxLink({
  chain,
  txId,
  className,
}: {
  chain: Chain;
  txId: string | null;
  className?: string;
}) {
  if (!txId) return null;
  const title = `Транзакция в ${CHAIN_META[chain].explorerName}`;
  return (
    <a
      href={explorerTxUrl(chain, txId)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={className ?? "inline-flex text-muted-foreground hover:text-foreground"}
      title={title}
      aria-label={title}
    >
      <ExternalLink className="size-3.5" />
    </a>
  );
}
