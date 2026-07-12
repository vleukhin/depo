import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, verifySessionToken } from "@/lib/auth";

// /api/telegram открыт от cookie-гейта: вебхук Telegram аутентифицируется
// секрет-заголовком внутри самого роута (см. app/api/telegram/route.ts).
const PUBLIC_PATHS = new Set(["/login", "/api/login", "/api/telegram"]);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authed = verifySessionToken(request.cookies.get(COOKIE_NAME)?.value);

  if (PUBLIC_PATHS.has(pathname)) {
    if (authed && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (authed) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
