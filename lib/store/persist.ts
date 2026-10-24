import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { MemoryStore } from "./memory";
import { NAMESPACES, type StoreSnapshot } from "./types";

// Development persistence (06-data-model.md "P0 구현": debounced save to .data/store.json). Off unless
// PIBU_PERSIST=true outside production, so tests, builds and CI never write the file. DEMO_MODE does not matter:
// a demo run that should survive a dev server restart turns it on explicitly.

export const PERSIST_FILE = join(process.cwd(), ".data", "store.json");
export const PERSIST_DELAY_MS = 1000;

export function persistEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" && env.PIBU_PERSIST === "true";
}

/** The saved snapshot, or undefined when there is none or it does not look like one (then the seed loads). */
export function readPersisted(file: string = PERSIST_FILE): StoreSnapshot | undefined {
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    return undefined;
  }
  if (typeof data !== "object" || data === null) return undefined;
  const record = data as Record<string, unknown>;
  if (!NAMESPACES.every((ns) => typeof record[ns] === "object" && record[ns] !== null)) return undefined;
  return data as StoreSnapshot;
}

export function writePersisted(snapshot: StoreSnapshot, file: string = PERSIST_FILE): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(snapshot));
  renameSync(tmp, file);
}

export interface PersistentStore extends MemoryStore {
  /** Writes now if a save is pending. */
  flush(): void;
}

/** Wraps `store` so every write schedules one save `delayMs` after the last change. */
export function withPersistence(store: MemoryStore, file: string = PERSIST_FILE, delayMs: number = PERSIST_DELAY_MS): PersistentStore {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    if (timer === undefined) return;
    clearTimeout(timer);
    timer = undefined;
    try {
      writePersisted(store.snapshot(), file);
    } catch (error) {
      console.error(`store: could not save ${file}`, error);
    }
  };
  const schedule = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = setTimeout(flush, delayMs);
    timer.unref?.();
  };
  return {
    get: (ns, collection, id) => store.get(ns, collection, id),
    list: (ns, collection, filter) => store.list(ns, collection, filter),
    async put(ns, collection, value) {
      await store.put(ns, collection, value);
      schedule();
    },
    async remove(ns, collection, id) {
      await store.remove(ns, collection, id);
      schedule();
    },
    snapshot: () => store.snapshot(),
    restore(snapshot) {
      store.restore(snapshot);
      schedule();
    },
    flush,
  };
}
