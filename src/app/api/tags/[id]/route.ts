import { NextResponse } from "next/server";
import { handle, notFound, parseBody, parseId } from "@/lib/api-helpers";
import { tagInput } from "@/lib/validate";
import { deleteTag, tagNameTaken, updateTag } from "@/lib/repo";

export const runtime = "nodejs";

export function PUT(request: Request, ctx: RouteContext<"/api/tags/[id]">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    const input = await parseBody(request, tagInput);
    if (await tagNameTaken(input.name, id)) {
      throw NextResponse.json({ error: "Тег с таким названием уже есть" }, { status: 409 });
    }
    const updated = await updateTag(id, input);
    if (!updated) notFound();
    return NextResponse.json(updated);
  });
}

// Тег снимается со всех записей каскадом (placement_tags ON DELETE CASCADE).
export function DELETE(_request: Request, ctx: RouteContext<"/api/tags/[id]">) {
  return handle(async () => {
    const id = parseId((await ctx.params).id);
    if (!(await deleteTag(id))) notFound();
    return NextResponse.json({ ok: true });
  });
}
