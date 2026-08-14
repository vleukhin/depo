"use client";

import { useCallback, useSyncExternalStore } from "react";

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

/**
 * Состояние «свёрнуто» для блока с идентификатором `id`.
 * `defaultCollapsed` — значение, пока пользователь ничего не переключал.
 */
export function useCollapsed(
  id: string,
  defaultCollapsed = false,
): [boolean, () => void] {
  const storageKey = `depo:collapsed:${id}`;

  const collapsed = useSyncExternalStore(
    subscribe,
    () => {
      const saved = localStorage.getItem(storageKey);
      return saved === null ? defaultCollapsed : saved === "1";
    },
    () => defaultCollapsed, // на сервере — значение по умолчанию
  );

  const toggle = useCallback(() => {
    localStorage.setItem(storageKey, collapsed ? "0" : "1");
    window.dispatchEvent(new Event(TOGGLE_EVENT));
  }, [storageKey, collapsed]);

  return [collapsed, toggle];
}
