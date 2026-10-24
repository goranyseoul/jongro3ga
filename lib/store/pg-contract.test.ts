import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { openMemoryDb, type DbHandle } from "../db";
import { createMemoryStore } from "./memory";
import { createPgStore, type PgStore } from "./pg";
import type { Namespace, Store, StoreSnapshot } from "./types";

// PGlite start-up and password hashing are slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

// One Store contract, run against both implementations: the memory store (unit tests, build) and the
// Postgres store (PGlite in memory here; Neon or PGlite on disk at runtime). Every other track only
// sees getStore(), so the two must be indistinguishable through the Store interface.

interface Item {
  id: string;
  name: string;
  tags?: string[];
  meta?: { level: number; note?: string };
}

interface Subject {
  store: Store;
  snapshot(): Promise<StoreSnapshot>;
  restore(snapshot?: Partial<StoreSnapshot>): Promise<void>;
}

function contract(label: string, setup: () => Promise<{ fresh(): Promise<Subject>; teardown(): Promise<void> }>) {
  describe(`Store contract: ${label}`, () => {
    let env: Awaited<ReturnType<typeof setup>>;
    let subject: Subject;
    let store: Store;

    beforeAll(async () => {
      env = await setup();
    });
    afterAll(async () => {
      await env.teardown();
    });
    beforeEach(async () => {
      subject = await env.fresh();
      store = subject.store;
    });

    it("round trips an item and returns undefined for a missing one", async () => {
      await store.put<Item>("clinic", "menu", { id: "m1", name: "rejuran" });
      expect(await store.get<Item>("clinic", "menu", "m1")).toEqual({ id: "m1", name: "rejuran" });
      expect(await store.get<Item>("clinic", "menu", "nope")).toBeUndefined();
      expect(await store.get<Item>("clinic", "other-collection", "m1")).toBeUndefined();
    });

    it("returns copies: mutating a result or the input never changes stored data", async () => {
      const input: Item = { id: "m1", name: "a", tags: ["x"] };
      await store.put("clinic", "menu", input);
      input.name = "changed after put";
      input.tags!.push("y");

      const first = (await store.get<Item>("clinic", "menu", "m1"))!;
      expect(first).toEqual({ id: "m1", name: "a", tags: ["x"] });
      first.name = "changed after get";
      first.tags!.push("z");
      const listed = await store.list<Item>("clinic", "menu");
      listed[0].name = "changed after list";

      expect(await store.get<Item>("clinic", "menu", "m1")).toEqual({ id: "m1", name: "a", tags: ["x"] });
    });

    it("replaces by id and keeps the original list position", async () => {
      await store.put<Item>("clinic", "menu", { id: "a", name: "first" });
      await store.put<Item>("clinic", "menu", { id: "b", name: "second" });
      await store.put<Item>("clinic", "menu", { id: "c", name: "third" });
      await store.put<Item>("clinic", "menu", { id: "a", name: "first v2" });
      await store.put<Item>("clinic", "menu", { id: "b", name: "second v2" });
      expect((await store.list<Item>("clinic", "menu")).map((i) => i.name)).toEqual(["first v2", "second v2", "third"]);
    });

    it("puts a removed then re-added item at the end", async () => {
      await store.put<Item>("clinic", "menu", { id: "a", name: "a" });
      await store.put<Item>("clinic", "menu", { id: "b", name: "b" });
      await store.remove("clinic", "menu", "a");
      await store.put<Item>("clinic", "menu", { id: "a", name: "a again" });
      expect((await store.list<Item>("clinic", "menu")).map((i) => i.id)).toEqual(["b", "a"]);
    });

    it("keeps insertion order across many items, not id order", async () => {
      const ids = ["z", "10", "b", "2", "a", "1"];
      for (const id of ids) await store.put<Item>("platform", "order", { id, name: id });
      expect((await store.list<Item>("platform", "order")).map((i) => i.id)).toEqual(ids);
    });

    it("removes an item and treats removing a missing one as a no-op", async () => {
      await store.put<Item>("clinic", "menu", { id: "a", name: "x" });
      await store.remove("clinic", "menu", "a");
      await store.remove("clinic", "menu", "a");
      await store.remove("clinic", "never-created", "a");
      expect(await store.list("clinic", "menu")).toEqual([]);
    });

    it("rejects items without a usable id and unknown namespaces or empty collections", async () => {
      await expect(store.put("clinic", "menu", { id: "", name: "x" })).rejects.toThrow(TypeError);
      await expect(store.put("clinic", "menu", { name: "x" } as unknown as { id: string })).rejects.toThrow(TypeError);
      await expect(store.put("clinic", "", { id: "a" })).rejects.toThrow(TypeError);
      await expect(store.get("admin" as Namespace, "menu", "a")).rejects.toThrow(TypeError);
      await expect(store.list("admin" as Namespace, "menu")).rejects.toThrow(TypeError);
      await expect(store.remove("admin" as Namespace, "menu", "a")).rejects.toThrow(TypeError);
    });

    describe("list filters", () => {
      beforeEach(async () => {
        await store.put<Item>("platform", "things", { id: "1", name: "a", tags: ["x", "y"], meta: { level: 1 } });
        await store.put<Item>("platform", "things", { id: "2", name: "b", tags: ["x"], meta: { level: 2 } });
        await store.put<Item>("platform", "things", { id: "3", name: "a", meta: { level: 2 } });
        await store.put<Item>("platform", "things", { id: "4", name: "c", meta: { note: "n", level: 3 } });
      });

      it("returns everything in insertion order without a filter, and [] for an empty collection", async () => {
        expect((await store.list<Item>("platform", "things")).map((i) => i.id)).toEqual(["1", "2", "3", "4"]);
        expect(await store.list("platform", "empty")).toEqual([]);
      });

      it("filters by primitive fields, nested objects and arrays with deep equality", async () => {
        expect((await store.list<Item>("platform", "things", { name: "a" })).map((i) => i.id)).toEqual(["1", "3"]);
        expect((await store.list<Item>("platform", "things", { meta: { level: 2 } })).map((i) => i.id)).toEqual(["2", "3"]);
        expect((await store.list<Item>("platform", "things", { tags: ["x"] })).map((i) => i.id)).toEqual(["2"]);
        expect((await store.list<Item>("platform", "things", { tags: ["y", "x"] })).map((i) => i.id)).toEqual([]);
        expect((await store.list<Item>("platform", "things", { name: "a", meta: { level: 2 } })).map((i) => i.id)).toEqual(["3"]);
      });

      it("matches nested objects regardless of key order but not partial objects", async () => {
        expect((await store.list<Item>("platform", "things", { meta: { level: 3, note: "n" } })).map((i) => i.id)).toEqual(["4"]);
        expect(await store.list<Item>("platform", "things", { meta: { level: 3 } })).toEqual([]);
      });

      it("ignores undefined filter fields and does not match items missing the field", async () => {
        expect(await store.list<Item>("platform", "things", { name: undefined })).toHaveLength(4);
        expect(await store.list<Item>("platform", "things", { tags: [] })).toEqual([]);
        expect(await store.list<Item & { missing?: null }>("platform", "things", { missing: null })).toEqual([]);
      });

      it("distinguishes numbers from numeric strings and booleans", async () => {
        await store.put("platform", "typed", { id: "n", v: 1 });
        await store.put("platform", "typed", { id: "s", v: "1" });
        await store.put("platform", "typed", { id: "b", v: true });
        expect((await store.list<{ id: string; v: unknown }>("platform", "typed", { v: 1 })).map((i) => i.id)).toEqual(["n"]);
        expect((await store.list<{ id: string; v: unknown }>("platform", "typed", { v: "1" })).map((i) => i.id)).toEqual(["s"]);
        expect((await store.list<{ id: string; v: unknown }>("platform", "typed", { v: true })).map((i) => i.id)).toEqual(["b"]);
      });
    });

    it("keeps the same collection and id apart across namespaces and across collections", async () => {
      await store.put<Item>("customer", "records", { id: "x", name: "customer side" });
      await store.put<Item>("platform", "records", { id: "x", name: "platform side" });
      await store.put<Item>("platform", "other", { id: "x", name: "other collection" });

      expect((await store.get<Item>("customer", "records", "x"))!.name).toBe("customer side");
      expect((await store.get<Item>("platform", "records", "x"))!.name).toBe("platform side");
      expect(await store.get<Item>("clinic", "records", "x")).toBeUndefined();

      await store.remove("platform", "records", "x");
      expect((await store.get<Item>("customer", "records", "x"))!.name).toBe("customer side");
      expect((await store.get<Item>("platform", "other", "x"))!.name).toBe("other collection");
    });

    it("is safe with prototype-looking and quote-heavy collection and id names", async () => {
      await store.put<Item>("shared", "__proto__", { id: "__proto__", name: "p" });
      await store.put<Item>("shared", "it's \"odd\"", { id: "'; drop table x; --", name: "q" });
      expect((await store.get<Item>("shared", "__proto__", "__proto__"))!.name).toBe("p");
      expect((await store.get<Item>("shared", "it's \"odd\"", "'; drop table x; --"))!.name).toBe("q");
      expect(({} as Record<string, unknown>).name).toBeUndefined();
      expect(Object.keys((await subject.snapshot()).shared).sort()).toEqual(["__proto__", "it's \"odd\""]);
    });

    it("stores unicode and nested data unchanged", async () => {
      const value = { id: "u", name: "ゆき 지수 林", deep: { list: [1, { a: [true, null, "x"] }], empty: {} } };
      await store.put("customer", "profiles", value);
      expect(await store.get("customer", "profiles", "u")).toEqual(value);
    });

    it("snapshot and restore round trip, and restore replaces all content", async () => {
      await store.put<Item>("customer", "records", { id: "a", name: "A", tags: ["t"] });
      await store.put<Item>("clinic", "menu", { id: "b", name: "B" });
      const snap = await subject.snapshot();
      expect(snap.customer.records).toEqual({ a: { id: "a", name: "A", tags: ["t"] } });
      expect(snap.platform).toEqual({});

      (snap.customer.records.a as Item).name = "mutated";
      expect((await store.get<Item>("customer", "records", "a"))!.name).toBe("A");

      await subject.restore({ shared: { logs: { l1: { id: "l1", name: "log" }, l2: { id: "l2", name: "log2" } } } });
      expect(await store.list("customer", "records")).toEqual([]);
      expect(await store.list("clinic", "menu")).toEqual([]);
      expect((await store.list<Item>("shared", "logs")).map((i) => i.id)).toEqual(["l1", "l2"]);

      // items added after a restore go after the restored ones
      await store.put<Item>("shared", "logs", { id: "l0", name: "late" });
      expect((await store.list<Item>("shared", "logs")).map((i) => i.id)).toEqual(["l1", "l2", "l0"]);
    });
  });
}

contract("memory", async () => ({
  async fresh() {
    const store = createMemoryStore();
    return { store, snapshot: async () => store.snapshot(), restore: async (s) => store.restore(s) };
  },
  async teardown() {},
}));

contract("postgres (PGlite)", async () => {
  const handle: DbHandle = await openMemoryDb();
  const store: PgStore = createPgStore(async () => handle.db);
  return {
    async fresh() {
      await store.restore();
      return { store, snapshot: () => store.snapshot(), restore: (s) => store.restore(s) };
    },
    teardown: () => handle.close(),
  };
});

describe("postgres store reset (resetStore on pg)", () => {
  let handle: DbHandle;
  let store: PgStore;
  beforeAll(async () => {
    handle = await openMemoryDb();
    store = createPgStore(async () => handle.db);
  });
  afterAll(() => handle.close());

  it("queues a synchronous reset so later calls see the wiped or seeded state", async () => {
    await store.put<Item>("shared", "log", { id: "a", name: "x" });
    store.reset();
    expect(await store.list("shared", "log")).toEqual([]);

    store.reset({ clinic: { menu: { m: { id: "m", name: "seeded" } } } });
    expect(await store.get<Item>("clinic", "menu", "m")).toEqual({ id: "m", name: "seeded" });
    expect(await store.collections("clinic")).toEqual(["menu"]);
  });

  it("surfaces a failed reset once on the next call instead of hiding it", async () => {
    store.reset({ clinic: { "": { x: { id: "x" } } } });
    await expect(store.list("clinic", "menu")).rejects.toThrow(TypeError);
    expect(await store.list("clinic", "menu")).toBeDefined();
  });
});
