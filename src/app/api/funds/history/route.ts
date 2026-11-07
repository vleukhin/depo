import { type NextRequest, NextResponse } from "next/server";
import { handle, parsePage } from "@/lib/api-helpers";
import { listFundHistory } from "@/lib/repo";

export const runtime = "nodejs";

// История изменений состава депо: ?page=N, по 20 записей, новые сверху.
export function GET(request: NextRequest) {
  return handle(async () =>
    NextResponse.json(await listFundHistory(parsePage(request.nextUrl.searchParams.get("page")))),
  );
}
