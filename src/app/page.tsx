import { SiteHeader } from "@/components/SiteHeader";
import { HeroCard } from "@/features/dashboard/HeroCard";
import { DepoStructureCard } from "@/features/dashboard/DepoStructureCard";
import { TrxChartCard } from "@/features/dashboard/TrxChartCard";
import { PlacementsSection } from "@/features/placements/PlacementsSection";
import { DebtsSection } from "@/features/debts/DebtsSection";

export default function Home() {
  return (
    <>
      <SiteHeader />

      <section className="mx-auto w-full max-w-6xl px-4 pt-6 pb-8">
        <HeroCard />
      </section>

      <main className="mx-auto w-full max-w-6xl px-4 pb-12 space-y-8">
        {/* Ряд диаграмм: структура депо (донат) и динамика TRX. */}
        <div className="grid gap-5 lg:grid-cols-2">
          <DepoStructureCard />
          <TrxChartCard />
        </div>

        <div className="space-y-6">
          <PlacementsSection />
          <DebtsSection />
        </div>
      </main>
    </>
  );
}
