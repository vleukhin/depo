import { NextResponse } from "next/server";
import { handle, parseBody } from "@/lib/api-helpers";
import { tagInput } from "@/lib/validate";
import { createTag, listTags, tagNameTaken } from "@/lib/repo";

export const runtime = "nodejs";

export function GET() {
  return handle(async () => NextResponse.json(await listTags()));
}

export function POST(request: Request) {
  return handle(async () => {
    const input = await parseBody(request, tagInput);
    if (await tagNameTaken(input.name)) {
      throw NextResponse.json({ error: "Тег с таким названием уже есть" }, { status: 409 });
    }
    return NextResponse.json(await createTag(input), { status: 201 });
  });
}
