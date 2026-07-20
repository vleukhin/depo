import { ExternalLink } from "lucide-react";

/** Иконка-ссылка на транзакцию в Tronscan. Ничего не рендерит, если хэша нет. */
export function TxLink({ txId, className }: { txId: string | null; className?: string }) {
  if (!txId) return null;
  return (
    <a
      href={`https://tronscan.org/#/transaction/${txId.trim()}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={className ?? "inline-flex text-muted-foreground hover:text-foreground"}
      title="Транзакция в Tronscan"
      aria-label="Транзакция в Tronscan"
    >
      <ExternalLink className="size-3.5" />
    </a>
  );
}
