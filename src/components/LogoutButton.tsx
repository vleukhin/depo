"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export function LogoutButton() {
  async function logout() {
    await api.post("/api/logout", {});
    window.location.href = "/login";
  }

  return (
    <Button variant="ghost" size="sm" onClick={logout} title="Выйти">
      <LogOut className="size-4" />
      Выйти
    </Button>
  );
}
