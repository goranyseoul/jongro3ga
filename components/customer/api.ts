"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Client side of the customer BFF (09: the customer screens call only app/api/customer/*).

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const response = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
    cache: "no-store",
  });
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
  if (!response.ok) throw new ApiError(response.status, body.error ?? "error", body.message);
  return body as T;
}

export interface ApiState<T> {
  data: T | undefined;
  error: ApiError | undefined;
  loading: boolean;
  reload: () => Promise<void>;
}

/**
 * GET `path` on mount and, when `pollMs` is set, every pollMs while `keepPolling(data)` is true
 * (request progress polls every 2s, 09 "고객 에이전트의 오케스트레이션").
 */
export function useApi<T>(path: string | null, options: { pollMs?: number; keepPolling?: (data: T) => boolean } = {}): ApiState<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<ApiError>();
  const [loading, setLoading] = useState(path !== null);
  const keepPolling = useRef(options.keepPolling);
  keepPolling.current = options.keepPolling;

  const load = useCallback(async () => {
    if (!path) return;
    try {
      const next = await api<T>(path);
      setData(next);
      setError(undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError(0, "network"));
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!options.pollMs || !path) return;
    if (data !== undefined && keepPolling.current && !keepPolling.current(data)) return;
    const timer = window.setTimeout(() => void load(), options.pollMs);
    return () => window.clearTimeout(timer);
  }, [data, error, load, options.pollMs, path]);

  return { data, error, loading, reload: load };
}
