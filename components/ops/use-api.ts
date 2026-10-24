"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorText } from "@/lib/ui-data/ops";

export type ApiState<T> = {
  data: T | null;
  /** Message of the last failed load, null when the last load worked. */
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
};

/**
 * Loads `fetcher` on mount, on reload() and whenever `key` changes (for example the active filters);
 * with `intervalMs` it polls while the tab is visible. A response that arrives after a newer request
 * started is dropped, so polling never shows stale rows.
 */
export function useApi<T>(fetcher: () => Promise<T>, intervalMs?: number, key?: string): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const reload = useCallback(async () => {
    const ticket = ++latest.current;
    try {
      const next = await fetcherRef.current();
      if (ticket !== latest.current) return;
      setData(next);
      setError(null);
    } catch (failure) {
      if (ticket !== latest.current) return;
      setError(errorText(failure));
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    if (!intervalMs) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void reload();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [reload, intervalMs, key]);

  return { data, error, loading, reload };
}
