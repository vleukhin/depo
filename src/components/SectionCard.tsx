"use client";

import { useCallback, useSyncExternalStore } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** Схлопывание с сохранением в localStorage (useSyncExternalStore — без проблем с гидрацией). */
const TOGGLE_EVENT = "depo-collapsed-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(TOGGLE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(TOGGLE_EVENT, callback);
  };
}

function useCollapsed(id: string): [boolean, () => void] {
  const storageKey = `depo:collapsed:${id}`;

  const collapsed = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(storageKey) === "1",
    () => false, // на сервере всегда развёрнуто
  );

  const toggle = useCallback(() => {
    localStorage.setItem(storageKey, collapsed ? "0" : "1");
    window.dispatchEvent(new Event(TOGGLE_EVENT));
  }, [storageKey, collapsed]);

  return [collapsed, toggle];
}

export function SectionCard({
  id,
  title,
  description,
  onAdd,
  actions,
  children,
}: {
  id: string;
  title: string;
  description: string;
  onAdd: () => void;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [collapsed, toggle] = useCollapsed(id);

  return (
    <Card>
      <CardHeader className="cursor-pointer select-none" onClick={toggle}>
        <CardTitle className="flex items-center gap-2">
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              collapsed && "-rotate-90",
            )}
          />
          {title}
        </CardTitle>
        <CardDescription className="pl-6">{description}</CardDescription>
        <CardAction
          className="flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {actions}
          <Button size="sm" onClick={onAdd}>
            <Plus className="size-4" />
            Добавить
          </Button>
        </CardAction>
      </CardHeader>
      {!collapsed && <CardContent>{children}</CardContent>}
    </Card>
  );
}
