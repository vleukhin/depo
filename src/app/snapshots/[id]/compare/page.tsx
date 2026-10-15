import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SnapshotDiffView } from "@/features/snapshots/SnapshotDiffView";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "Сравнение снимков — Депо",
};

export default async function SnapshotComparePage({
  params,
  searchParams,
}: PageProps<"/snapshots/[id]/compare">) {
  const id = Number((await params).id);
  const raw = (await searchParams).with;
  const target = (Array.isArray(raw) ? raw[0] : raw) || "current";
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 space-y-8">
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/snapshots/${id}`}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            К снимку
          </Link>
          <ThemeToggle />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Сравнение снимков</h1>
      </header>

      <SnapshotDiffView id={id} target={target} />
    </main>
  );
}
