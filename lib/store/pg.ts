import { and, asc, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "../db";
import { storeItems } from "../db/schema";
import { NAMESPACES, type Namespace, type Store, type StoreSnapshot } from "./types";

// Postgres implementation of the Store contract (lib/store/types.ts) over one generic JSONB table,
// store_items(namespace, collection, id, data, position). Semantics match the memory store:
// - list() returns insertion order (position is set on first insert only, so a replaced item keeps
//   its place and a removed then re-added item goes to the end);
// - filter matches top-level fields by deep equality (jsonb `=`: objects ignore key order, arrays
//   compare in order), undefined filter fields are ignored, items missing the field never match;
// - results are fresh objects, so callers cannot mutate stored state by reference.
// Values round trip through JSON: plain data only (no Date, Map, undefined-valued keys).

export interface PgStore extends Store {
  readonly kind: "pg";
  snapshot(): Promise<StoreSnapshot>;
  /** Replaces all content. Unlisted namespaces become empty. */
  restore(snapshot?: Partial<StoreSnapshot>): Promise<void>;
  /**
   * Synchronous form of restore for resetStore(): queues the restore, and every later store call
   * waits for it, so `resetStore(); await getStore().put(...)` behaves like the memory store.
   */
  reset(snapshot?: Partial<StoreSnapshot>): void;
  /** Waits for queued resets (and surfaces their error). */
  settled(): Promise<void>;
  /** Collection names that currently hold at least one item in `ns`. */
  collections(ns: Namespace): Promise<string[]>;
}

function checkNamespace(ns: Namespace): void {
  if (!NAMESPACES.includes(ns)) throw new TypeError(`unknown store namespace: ${String(ns)}`);
}

function checkCollection(collection: string): void {
  if (typeof collection !== "string" || collection === "") throw new TypeError("collection must be a non-empty string");
}

const INSERT_CHUNK = 500;

export function createPgStore(getDb: () => Promise<Db>): PgStore {
  let barrier: Promise<void> = Promise.resolve();
  let resetError: unknown;

  const db = async (): Promise<Db> => {
    await barrier;
    if (resetError !== undefined) {
      const error = resetError;
      resetError = undefined;
      throw error;
    }
    return getDb();
  };

  const restore = async (snapshot?: Partial<StoreSnapshot>): Promise<void> => {
    const rows: (typeof storeItems.$inferInsert)[] = [];
    for (const ns of NAMESPACES) {
      for (const [collection, items] of Object.entries(snapshot?.[ns] ?? {})) {
        checkCollection(collection);
        for (const [id, item] of Object.entries(items)) rows.push({ namespace: ns, collection, id, data: item });
      }
    }
    const conn = await getDb();
    await conn.transaction(async (tx) => {
      await tx.delete(storeItems);
      // one row per statement chunk, in snapshot order, so positions follow Object.entries order
      for (let i = 0; i < rows.length; i += INSERT_CHUNK) await tx.insert(storeItems).values(rows.slice(i, i + INSERT_CHUNK));
    });
  };

  return {
    kind: "pg",

    async get<T>(ns: Namespace, collection: string, id: string) {
      checkNamespace(ns);
      checkCollection(collection);
      const conn = await db();
      const rows = await conn
        .select({ data: storeItems.data })
        .from(storeItems)
        .where(and(eq(storeItems.namespace, ns), eq(storeItems.collection, collection), eq(storeItems.id, id)))
        .limit(1);
      return rows[0] ? (rows[0].data as T) : undefined;
    },

    async list<T>(ns: Namespace, collection: string, filter?: Partial<T>) {
      checkNamespace(ns);
      checkCollection(collection);
      const conditions: SQL[] = [eq(storeItems.namespace, ns), eq(storeItems.collection, collection)];
      for (const [key, expected] of Object.entries(filter ?? {})) {
        if (expected === undefined) continue;
        conditions.push(sql`${storeItems.data} -> ${key}::text = ${JSON.stringify(expected)}::jsonb`);
      }
      const conn = await db();
      const rows = await conn
        .select({ data: storeItems.data })
        .from(storeItems)
        .where(and(...conditions))
        .orderBy(asc(storeItems.position));
      return rows.map((row) => row.data as T);
    },

    async put<T extends { id: string }>(ns: Namespace, collection: string, value: T) {
      checkNamespace(ns);
      checkCollection(collection);
      if (typeof value?.id !== "string" || value.id === "") throw new TypeError("item.id must be a non-empty string");
      const conn = await db();
      await conn
        .insert(storeItems)
        .values({ namespace: ns, collection, id: value.id, data: value })
        .onConflictDoUpdate({
          target: [storeItems.namespace, storeItems.collection, storeItems.id],
          set: { data: sql`excluded.data`, updatedAt: sql`now()` },
        });
    },

    async remove(ns: Namespace, collection: string, id: string) {
      checkNamespace(ns);
      checkCollection(collection);
      const conn = await db();
      await conn
        .delete(storeItems)
        .where(and(eq(storeItems.namespace, ns), eq(storeItems.collection, collection), eq(storeItems.id, id)));
    },

    async snapshot() {
      const conn = await db();
      const rows = await conn
        .select({ namespace: storeItems.namespace, collection: storeItems.collection, id: storeItems.id, data: storeItems.data })
        .from(storeItems)
        .orderBy(asc(storeItems.position));
      const grouped = new Map<Namespace, Map<string, [string, unknown][]>>(NAMESPACES.map((ns) => [ns, new Map()]));
      for (const row of rows) {
        const collections = grouped.get(row.namespace as Namespace);
        if (!collections) continue;
        let items = collections.get(row.collection);
        if (!items) collections.set(row.collection, (items = []));
        items.push([row.id, row.data]);
      }
      // Object.fromEntries defines own keys, so "__proto__" stays a plain key like in the memory store
      const out = {} as StoreSnapshot;
      for (const [ns, collections] of grouped) {
        out[ns] = Object.fromEntries([...collections].map(([collection, items]) => [collection, Object.fromEntries(items)]));
      }
      return out;
    },

    async restore(snapshot) {
      await barrier;
      await restore(snapshot);
    },

    reset(snapshot) {
      barrier = barrier.then(() =>
        restore(snapshot).catch((error: unknown) => {
          console.error("[store] reset failed", error);
          resetError = error;
        }),
      );
    },

    async settled() {
      await db();
    },

    async collections(ns) {
      checkNamespace(ns);
      const conn = await db();
      const rows = await conn
        .selectDistinct({ collection: storeItems.collection })
        .from(storeItems)
        .where(eq(storeItems.namespace, ns))
        .orderBy(asc(storeItems.collection));
      return rows.map((row) => row.collection);
    },
  };
}
