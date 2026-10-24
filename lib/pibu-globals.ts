import type { MemoryStore } from "./store/memory";

// Process wide state lives on globalThis so dev server hot reload keeps it (09-architecture.md "SDK 함정" 5).
export interface PibuGlobals {
  store?: MemoryStore;
  /** Fixed demo time in epoch ms, set by setClock. Undefined means "start from the default again". */
  clockAt?: number;
}

declare global {
  var __pibu: PibuGlobals | undefined;
}

export function pibuGlobals(): PibuGlobals {
  return (globalThis.__pibu ??= {});
}
