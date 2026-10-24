"use client";

import { useSyncExternalStore } from "react";
import type { BookingStatus, IsoDateTime, ProductVerified, RecordStatus, TreatmentRecord } from "@/lib/ui-data/customer";

// Mock stand-in for the customer namespace of the store (06-data-model.md): a booking, an outcome,
// records the customer added, and per-record status choices live in this browser only.
// Reads and writes never throw: a blocked localStorage just leaves the seed data.

export type DemoBooking = { quoteId: string; slot: IsoDateTime; status: BookingStatus };

export type DemoOutcome = {
  paidKrw: number;
  receivedValue: number;
  productVerified: ProductVerified;
  satisfaction: number;
  painScore: number;
  comment: string;
  submittedAt: IsoDateTime;
};

export type DemoState = {
  requestStarted: boolean;
  booking?: DemoBooking;
  outcome?: DemoOutcome;
  addedRecords: TreatmentRecord[];
  recordStatus: Record<string, RecordStatus>;
  consents: Record<string, boolean>;
  deleted: boolean;
};

const KEY = "pibu.customer.demo.v1";
const EMPTY: DemoState = { requestStarted: false, addedRecords: [], recordStatus: {}, consents: {}, deleted: false };

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedState: DemoState = EMPTY;

function read(): DemoState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cachedRaw) return cachedState;
    cachedRaw = raw;
    cachedState = raw ? { ...EMPTY, ...(JSON.parse(raw) as Partial<DemoState>) } : EMPTY;
  } catch {
    cachedRaw = null;
    cachedState = EMPTY;
  }
  return cachedState;
}

export function updateDemoState(change: (state: DemoState) => DemoState): void {
  const next = change(read());
  try {
    const raw = JSON.stringify(next);
    window.localStorage.setItem(KEY, raw);
    cachedRaw = raw;
  } catch {
    // storage blocked: keep the change in memory for this page view
    cachedRaw = null;
  }
  cachedState = next;
  listeners.forEach((listener) => listener());
}

export function resetDemoState(): void {
  updateDemoState(() => EMPTY);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Server and first client render see the empty state, so hydration always matches. */
export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
