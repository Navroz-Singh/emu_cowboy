"use client";

import { useCallback, useState } from "react";

function resolveValue(value, fallbackValue) {
  return typeof value === "function" ? value(fallbackValue) : value;
}

function readFromSessionStorage(key, fallbackValue) {
  if (typeof window === "undefined" || !key) return fallbackValue;

  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallbackValue;
  } catch {
    return fallbackValue;
  }
}

export function useSessionStorage(key, initialValue) {
  const [version, setVersion] = useState(0);
  void version;
  const storedValue = readFromSessionStorage(key, initialValue);

  const setValue = useCallback((value) => {
    const currentValue = readFromSessionStorage(key, initialValue);
    const nextValue = resolveValue(value, currentValue);

    if (typeof window !== "undefined" && key) {
      try {
        window.sessionStorage.setItem(key, JSON.stringify(nextValue));
      } catch {
        // ignore storage write errors (quota/private mode)
      }
    }

    setVersion((valueAtRender) => valueAtRender + 1);
  }, [initialValue, key]);

  const removeValue = useCallback(() => {
    if (typeof window !== "undefined" && key) {
      try {
        window.sessionStorage.removeItem(key);
      } catch {
        // ignore storage remove errors
      }
    }
    setVersion((valueAtRender) => valueAtRender + 1);
  }, [key]);

  return [storedValue, setValue, removeValue];
}
