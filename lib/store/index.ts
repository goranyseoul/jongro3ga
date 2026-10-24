import { pibuGlobals } from "../pibu-globals";
import { createMemoryStore } from "./memory";
import type { Store, StoreSnapshot } from "./types";

export * from "./types";
export { createMemoryStore, type MemoryStore } from "./memory";

export function getStore(): Store {
  const g = pibuGlobals();
  return (g.store ??= createMemoryStore());
}

/** Empties the singleton (or loads `snapshot`) in place, so references already handed out stay valid. */
export function resetStore(snapshot?: Partial<StoreSnapshot>): void {
  const g = pibuGlobals();
  if (g.store) g.store.restore(snapshot);
  else g.store = createMemoryStore(snapshot);
}
