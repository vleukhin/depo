import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

/** Разбор и валидация тела запроса zod-схемой. Бросает Response при ошибке. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  return schema.parse(raw);
}

/** Оборачивает хендлер: превращает ZodError и брошенные Response в JSON-ответы. */
export async function handle(fn: () => Promise<NextResponse> | NextResponse): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof NextResponse) return err;
    if (err instanceof ZodError) {
      const message = err.issues[0]?.message ?? "Ошибка валидации";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Внутренняя ошибка";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function notFound(): never {
  throw NextResponse.json({ error: "Запись не найдена" }, { status: 404 });
}

/** Парсит числовой id из строки маршрута. */
export function parseId(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    throw NextResponse.json({ error: "Некорректный id" }, { status: 400 });
  }
  return id;
}
