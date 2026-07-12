import { DashboardCards } from "@/features/dashboard/DashboardCards";
import { FundsSection } from "@/features/funds/FundsSection";
import { PlacementsSection } from "@/features/placements/PlacementsSection";
import { DebtsSection } from "@/features/debts/DebtsSection";
import { LogoutButton } from "@/components/LogoutButton";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Депо</h1>
          <p className="text-muted-foreground">Учёт средств USDT: состав, размещение и долги</p>
        </div>
        <LogoutButton />
      </header>

      <DashboardCards />

      <div className="space-y-6">
        <FundsSection />
        <PlacementsSection />
        <DebtsSection />
      </div>
    </main>
  );
}
