"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ThemeToggle";
import { api } from "@/lib/api";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api.post("/api/login", { password });
      window.location.href = "/"; // полная перезагрузка: чистый старт react-query
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
      setPending(false);
    }
  }

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden px-4">
      {/* Мягкое фиолетовое свечение за карточкой. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      {/* Переключатель темы доступен до входа. */}
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-sm bg-[linear-gradient(180deg,oklch(0.55_0.23_285/0.06),transparent_45%)] shadow-raised">
        <CardHeader className="justify-items-center gap-2 text-center">
          <div className="grid size-10 place-items-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
            Д
          </div>
          <CardTitle className="text-xl font-semibold">Депо</CardTitle>
          <p className="text-sm text-muted-foreground">Вход в учёт средств</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={pending || !password}>
              {pending ? "Вход…" : "Войти"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
