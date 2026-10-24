import { getDb } from "../db";
import { pibuGlobals } from "../pibu-globals";
import { createMemoryStore } from "./memory";
import { createPgStore, type PgStore } from "./pg";
import type { Store, StoreSnapshot } from "./types";

export * from "./types";
export { createMemoryStore, type MemoryStore } from "./memory";
export { createPgStore, type PgStore } from "./pg";

export type StoreBackend = "memory" | "pg";

/**
 * Which implementation getStore() hands out.
 * - PIBOOK_STORE=memory|pg forces one.
 * - Unit tests (vitest) get the memory store, so resetStore() stays synchronous and isolated.
 * - `next build` gets the memory store: build workers run in parallel and must not open the same
 *   PGlite folder; pages that read data render dynamically at request time anyway.
 * - Everything else (next start, next dev, Vercel) gets Postgres: DATABASE_URL, else embedded PGlite.
 */
export function storeBackend(): StoreBackend {
  const forced = process.env.PIBOOK_STORE;
  if (forced === "memory" || forced === "pg") return forced;
  if (process.env.VITEST) return "memory";
  if (process.env.NEXT_PHASE === "phase-production-build") return "memory";
  return "pg";
}

interface StoreGlobals {
  pg?: PgStore;
}

declare global {
  var __pibookStore: StoreGlobals | undefined;
}

function pgSingleton(): PgStore {
  const g = (globalThis.__pibookStore ??= {});
  return (g.pg ??= createPgStore(getDb));
}

export function getStore(): Store {
  if (storeBackend() === "pg") return pgSingleton();
  const g = pibuGlobals();
  return (g.store ??= createMemoryStore());
}

/**
 * Empties the singleton (or loads `snapshot`) in place, so references already handed out stay valid.
 * On Postgres the wipe is queued and every later store call waits for it.
 */
export function resetStore(snapshot?: Partial<StoreSnapshot>): void {
  if (storeBackend() === "pg") {
    pgSingleton().reset(snapshot);
    return;
  }
  const g = pibuGlobals();
  if (g.store) g.store.restore(snapshot);
  else g.store = createMemoryStore(snapshot);
}
