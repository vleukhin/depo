"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "depo-stored-boolean-change";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

/** Булевое UI-состояние с сохранением в localStorage и безопасной гидрацией. */
export function useStoredBoolean(
  storageKey: string,
  defaultValue = false,
): [boolean, () => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const saved = localStorage.getItem(storageKey);
      return saved === null ? defaultValue : saved === "1";
    },
    () => defaultValue,
  );

  const toggle = useCallback(() => {
    localStorage.setItem(storageKey, value ? "0" : "1");
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [storageKey, value]);

  return [value, toggle];
}
