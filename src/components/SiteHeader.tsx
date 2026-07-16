"use client";

import * as React from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LogoutButton } from "@/components/LogoutButton";

/** Прилипающая верхняя панель: монограмма + логотип, переключатель темы и выход.
 *  Нижняя граница появляется только после прокрутки (data-scrolled). */
export function SiteHeader() {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-scrolled={scrolled}
      className="sticky top-0 z-40 border-b border-transparent bg-background/70 backdrop-blur-md transition-colors supports-[backdrop-filter]:bg-background/60 data-[scrolled=true]:border-border"
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground font-semibold">
            Д
          </span>
          <span className="font-semibold tracking-tight">Депо</span>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
