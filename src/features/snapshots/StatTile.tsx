import { Card, CardContent } from "@/components/ui/card";

/** Итоговая плитка снимка: подпись + сумма. */
export function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-card">
      <CardContent className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {children}
      </CardContent>
    </Card>
  );
}
