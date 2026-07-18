import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SnapshotsList } from "@/features/snapshots/SnapshotsList";
import { SnapshotCreateButton } from "@/features/snapshots/SnapshotCreateButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Снимки депо — Депо",
};

export default function SnapshotsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 space-y-8">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            К депо
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Снимки депо</h1>
          <SnapshotCreateButton />
        </div>
      </header>

      <SnapshotsList />
    </main>
  );
}
