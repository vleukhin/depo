import { NextResponse } from "next/server";
import { z } from "zod";
import {
  COOKIE_NAME,
  SESSION_TTL_S,
  createSessionToken,
  verifyPassword,
} from "@/lib/auth";

export const runtime = "nodejs";

const loginInput = z.object({ password: z.string().min(1) });

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = loginInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Введите пароль" }, { status: 400 });
  }
  if (!verifyPassword(parsed.data.password)) {
    return NextResponse.json({ error: "Неверный пароль" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_S,
    // в проде (HTTPS) — только по защищённому соединению; в dev по http — без secure
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
