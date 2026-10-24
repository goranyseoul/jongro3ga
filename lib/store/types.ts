// Store contract from docs/spec/06-data-model.md. Each agent module touches only its own namespace;
// the import boundary is enforced by scripts/check-boundaries.mjs, not by the store.
export type Namespace = "customer" | "platform" | "clinic" | "shared";

export const NAMESPACES: readonly Namespace[] = ["customer", "platform", "clinic", "shared"];

export interface Store {
  get<T>(ns: Namespace, collection: string, id: string): Promise<T | undefined>;
  /** Items in insertion order. `filter` matches top-level fields by deep equality, undefined fields are ignored. */
  list<T>(ns: Namespace, collection: string, filter?: Partial<T>): Promise<T[]>;
  /** Inserts or replaces by `id`. A replaced item keeps its list position. */
  put<T extends { id: string }>(ns: Namespace, collection: string, value: T): Promise<void>;
  remove(ns: Namespace, collection: string, id: string): Promise<void>;
}

/** namespace -> collection -> id -> item, plain JSON-like data. */
export type StoreSnapshot = Record<Namespace, Record<string, Record<string, unknown>>>;
