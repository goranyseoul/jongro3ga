import { createMemoryStore, type MemoryStore } from "./memory";
import type { Store, StoreSnapshot } from "./types";

export * from "./types";
export { createMemoryStore, type MemoryStore } from "./memory";

// Dev server hot reload re-evaluates modules, so process-wide singletons live on globalThis (09-architecture.md).
interface PibuGlobals {
  store?: MemoryStore;
}

declare global {
  var __pibu: PibuGlobals | undefined;
}

function globals(): PibuGlobals {
  return (globalThis.__pibu ??= {});
}

export function getStore(): Store {
  const g = globals();
  return (g.store ??= createMemoryStore());
}

/** Empties the singleton (or loads `snapshot`) in place, so references already handed out stay valid. */
export function resetStore(snapshot?: Partial<StoreSnapshot>): void {
  const g = globals();
  if (g.store) g.store.restore(snapshot);
  else g.store = createMemoryStore(snapshot);
}
