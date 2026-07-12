"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <main className="min-h-dvh flex items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-4 text-muted-foreground" />
            Депо — вход
          </CardTitle>
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
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
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
