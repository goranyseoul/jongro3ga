import { NAMESPACES, type Namespace, type Store, type StoreSnapshot } from "./types";

export interface MemoryStore extends Store {
  snapshot(): StoreSnapshot;
  /** Replaces all content. Unlisted namespaces become empty. */
  restore(snapshot?: Partial<StoreSnapshot>): void;
}

type Collections = Map<string, Map<string, unknown>>;

// Values go in and out as structured clones so callers cannot mutate stored state by reference.
// Items must be plain data (no functions or class instances), which the spec types already are.
export function createMemoryStore(initial?: Partial<StoreSnapshot>): MemoryStore {
  const data = new Map<Namespace, Collections>();

  const reset = () => {
    for (const ns of NAMESPACES) data.set(ns, new Map());
  };

  const bucket = (ns: Namespace, collection: string, create: boolean): Map<string, unknown> | undefined => {
    const collections = data.get(ns);
    if (!collections) throw new TypeError(`unknown store namespace: ${String(ns)}`);
    if (typeof collection !== "string" || collection === "") throw new TypeError("collection must be a non-empty string");
    let items = collections.get(collection);
    if (!items && create) {
      items = new Map();
      collections.set(collection, items);
    }
    return items;
  };

  const store: MemoryStore = {
    async get<T>(ns: Namespace, collection: string, id: string) {
      const item = bucket(ns, collection, false)?.get(id);
      return item === undefined ? undefined : (structuredClone(item) as T);
    },

    async list<T>(ns: Namespace, collection: string, filter?: Partial<T>) {
      const items = bucket(ns, collection, false);
      if (!items) return [];
      const entries = Object.entries(filter ?? {}).filter(([, expected]) => expected !== undefined);
      const out: T[] = [];
      for (const item of items.values()) {
        const record = item as Record<string, unknown>;
        if (entries.every(([key, expected]) => deepEqual(record[key], expected))) out.push(structuredClone(item) as T);
      }
      return out;
    },

    async put<T extends { id: string }>(ns: Namespace, collection: string, value: T) {
      if (typeof value?.id !== "string" || value.id === "") throw new TypeError("item.id must be a non-empty string");
      bucket(ns, collection, true)!.set(value.id, structuredClone(value));
    },

    async remove(ns: Namespace, collection: string, id: string) {
      bucket(ns, collection, false)?.delete(id);
    },

    snapshot() {
      const out = {} as StoreSnapshot;
      for (const ns of NAMESPACES) {
        out[ns] = Object.fromEntries(
          [...data.get(ns)!].map(([collection, items]) => [collection, structuredClone(Object.fromEntries(items))]),
        );
      }
      return out;
    },

    restore(snapshot) {
      reset();
      for (const ns of NAMESPACES) {
        for (const [collection, items] of Object.entries(snapshot?.[ns] ?? {})) {
          const target = bucket(ns, collection, true)!;
          for (const [id, item] of Object.entries(items)) target.set(id, structuredClone(item));
        }
      }
    },
  };

  reset();
  if (initial) store.restore(initial);
  return store;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key) => Object.hasOwn(b, key) && deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}
