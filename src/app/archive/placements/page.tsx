import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PlacementsArchive } from "@/features/placements/PlacementsArchive";

export const metadata: Metadata = {
  title: "Архив размещений — Депо",
};

export default function PlacementsArchivePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 space-y-8">
      <header className="space-y-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          К депо
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Архив размещений</h1>
      </header>

      <PlacementsArchive />
    </main>
  );
}
