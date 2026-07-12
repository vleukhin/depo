// Простая авторизация для одного пользователя: пароль в APP_PASSWORD,
// сессия — HMAC-подписанный токен в httpOnly-cookie.

import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_NAME = "depo_session";
export const SESSION_TTL_S = 30 * 24 * 3600; // 30 дней

/** Ключ подписи зависит от пароля: смена APP_PASSWORD разлогинивает все сессии. */
function secretKey(): Buffer {
  const password = process.env.APP_PASSWORD ?? "";
  const secret = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${secret}:${password}`).digest();
}

export function createSessionToken(): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_S;
  const sig = createHmac("sha256", secretKey()).update(String(exp)).digest("hex");
  return `${exp}.${sig}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false;
  const [expStr, sig] = token.split(".");
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isInteger(exp) || exp * 1000 < Date.now()) return false;
  const expected = createHmac("sha256", secretKey()).update(expStr).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function verifyPassword(password: string): boolean {
  const expected = process.env.APP_PASSWORD ?? "";
  if (!expected) return false; // без APP_PASSWORD вход закрыт полностью
  // сравнение хэшей — постоянное время и одинаковая длина буферов
  const a = createHash("sha256").update(password).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
