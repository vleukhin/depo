import { NextResponse } from "next/server";
import { handle, notFound, parseBody, parseId } from "@/lib/api-helpers";
import { managerInput } from "@/lib/validate";
import { deleteManager, managerInUse, updateManager } from "@/lib/repo";

export const runtime = "nodejs";

export function PUT(request: Request, ctx: RouteContext<"/api/managers/[id]">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    const input = await parseBody(request, managerInput);
    const updated = await updateManager(id, input);
    if (!updated) notFound();
    return NextResponse.json(updated);
  });
}

export function DELETE(_request: Request, ctx: RouteContext<"/api/managers/[id]">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    if (await managerInUse(id)) {
      throw NextResponse.json(
        { error: "Нельзя удалить менеджера: есть связанные долги" },
        { status: 409 },
      );
    }
    if (!(await deleteManager(id))) notFound();
    return NextResponse.json({ ok: true });
  });
}
