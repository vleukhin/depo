import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SnapshotView } from "@/features/snapshots/SnapshotView";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Снимок депо — Депо",
};

export default async function SnapshotPage({ params }: PageProps<"/snapshots/[id]">) {
  const id = Number((await params).id);
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 space-y-8">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            href="/snapshots"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Ко всем снимкам
          </Link>
          <ThemeToggle />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Снимок депо</h1>
      </header>

      <SnapshotView id={id} />
    </main>
  );
}
