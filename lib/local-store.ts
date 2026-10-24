"use client";

import { useSyncExternalStore } from "react";

// One JSON value in localStorage behind useSyncExternalStore, the pattern the console sessions share
// (same contract as components/customer/session.ts, kept separate so the consoles do not import it).
// Reads and writes never throw: blocked storage keeps the value in memory for this page view.
// The server snapshot is null, so the first client render matches the server; screens that need the
// value render a signed-out or empty state first and never redirect during render.

export type LocalStore<T> = {
  read: () => T | null;
  write: (next: T | null) => void;
  subscribe: (listener: () => void) => () => void;
  useValue: () => T | null;
};

export function createLocalStore<T>(key: string): LocalStore<T> {
  const listeners = new Set<() => void>();
  let cachedRaw: string | null = null;
  let cachedValue: T | null = null;
  let memoryOnly = false;

  function read(): T | null {
    if (memoryOnly) return cachedValue;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === cachedRaw) return cachedValue;
      cachedRaw = raw;
      cachedValue = raw ? (JSON.parse(raw) as T) : null;
    } catch {
      cachedRaw = null;
      cachedValue = null;
    }
    return cachedValue;
  }

  function write(next: T | null): void {
    const raw = next ? JSON.stringify(next) : null;
    try {
      if (raw) window.localStorage.setItem(key, raw);
      else window.localStorage.removeItem(key);
      cachedRaw = raw;
      memoryOnly = false;
    } catch {
      memoryOnly = true;
      cachedRaw = null;
    }
    cachedValue = next;
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) listener();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }

  function useValue(): T | null {
    return useSyncExternalStore(subscribe, read, () => null);
  }

  return { read, write, subscribe, useValue };
}

const noopSubscribe = () => () => {};

/** False on the server and during hydration, true after. Lets a screen skip the signed-out flash. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
