import { pibuGlobals } from "../pibu-globals";
import { createMemoryStore, type MemoryStore } from "./memory";
import { persistEnabled, readPersisted, withPersistence } from "./persist";
import { defaultBaseUrl, loadSeed } from "./seed";
import type { Store, StoreSnapshot } from "./types";

export * from "./types";
export { createMemoryStore, type MemoryStore } from "./memory";
export { COLLECTIONS, PLATFORM_AGENT_ID, clinicAgentId } from "./collections";
export { buildSeedSnapshot, loadSeed, materializeAraBurst, validateSeed, type SeedOptions } from "./seed";

/**
 * The process singleton. Created on first use: with PIBU_PERSIST=true (dev only) it restores .data/store.json if
 * there is one, otherwise it loads the demo seed (data/seed/*.json).
 */
export function getStore(): Store {
  const g = pibuGlobals();
  if (!g.store) {
    const store = emptyStore();
    const saved = persistEnabled() ? readPersisted() : undefined;
    if (saved) store.restore(saved);
    else loadSeed(store, { baseUrl: defaultBaseUrl() });
    g.store = store;
  }
  return g.store;
}

/**
 * Resets the singleton in place, so references already handed out stay valid.
 * - `resetStore()` empties it, `resetStore(snapshot)` loads `snapshot` (tests).
 * - `resetStore({ seed: true })` reloads the demo seed (the demo control's "시드 리셋").
 */
export function resetStore(options: { seed: true }): void;
export function resetStore(snapshot?: Partial<StoreSnapshot>): void;
export function resetStore(arg?: Partial<StoreSnapshot> | { seed: true }): void {
  const g = pibuGlobals();
  const store = (g.store ??= emptyStore());
  if (arg && "seed" in arg && arg.seed === true) loadSeed(store, { baseUrl: defaultBaseUrl() });
  else store.restore(arg as Partial<StoreSnapshot> | undefined);
}

function emptyStore(): MemoryStore {
  const store = createMemoryStore();
  return persistEnabled() ? withPersistence(store) : store;
}
