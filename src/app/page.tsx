import { SiteHeader } from "@/components/SiteHeader";
import { HeroCard } from "@/features/dashboard/HeroCard";
import { GasHeroCard } from "@/features/dashboard/GasHeroCard";
import { DepoStructureCard } from "@/features/dashboard/DepoStructureCard";
import { GasChartCard } from "@/features/dashboard/GasChartCard";
import { PlacementsSection } from "@/features/placements/PlacementsSection";
import { DebtsSection } from "@/features/debts/DebtsSection";

export default function Home() {
  return (
    <>
      <SiteHeader />

      <section className="mx-auto w-full max-w-6xl px-4 pb-4 mt-1">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <HeroCard />
          </div>
          <GasHeroCard />
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl px-4 pb-12 space-y-8">
        {/* Ряд диаграмм: структура депо (донат) и динамика газа. */}
        <div className="grid gap-5 lg:grid-cols-2 mb-6 items-start">
          <DepoStructureCard />
          <GasChartCard />
        </div>

        <div className="space-y-6">
          <PlacementsSection />
          <DebtsSection />
        </div>
      </main>
    </>
  );
}
