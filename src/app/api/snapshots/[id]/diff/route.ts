import { NextResponse } from "next/server";
import { handle, notFound, parseId } from "@/lib/api-helpers";
import { getCurrentDepoState, getDepoSnapshot } from "@/lib/repo";
import { diffDepoStates } from "@/lib/snapshot-diff";
import type { DepoSnapshot, DepoSnapshotDetail, SnapshotComparison } from "@/types";

export const runtime = "nodejs";

/** Шапка снимка без блоков: блоки уже разобраны в diff, повторять их в ответе незачем. */
const header = (s: DepoSnapshotDetail): DepoSnapshot => ({
  id: s.id,
  comment: s.comment,
  created_at: s.created_at,
  total_funds: s.total_funds,
  total_placements: s.total_placements,
  total_debts: s.total_debts,
  total_native: s.total_native,
  diff: s.diff,
  balanced: s.balanced,
});

/**
 * Сравнение снимка (было) с другим снимком или текущим депо (стало):
 * ?with=current | <id снимка>.
 */
export function GET(request: Request, ctx: RouteContext<"/api/snapshots/[id]/diff">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    const withParam = new URL(request.url).searchParams.get("with") ?? "current";
    let targetId: number | null = null;
    if (withParam !== "current") {
      targetId = Number(withParam);
      if (!Number.isInteger(targetId) || targetId <= 0) {
        throw NextResponse.json({ error: "Некорректный параметр сравнения" }, { status: 400 });
      }
    }

    const base = await getDepoSnapshot(id);
    if (!base) notFound();
    const target = targetId === null ? null : await getDepoSnapshot(targetId);
    if (targetId !== null && !target) notFound();
    const targetState = target ?? (await getCurrentDepoState());

    const result: SnapshotComparison = {
      ...diffDepoStates(base, targetState),
      base: header(base),
      target: target ? header(target) : null,
    };
    return NextResponse.json(result);
  });
}
