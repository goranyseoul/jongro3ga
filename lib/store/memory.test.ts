import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore, type MemoryStore } from "./memory";
import { getStore, resetStore } from "./index";
import type { Namespace } from "./types";

interface Item {
  id: string;
  name: string;
  tags?: string[];
  meta?: { level: number };
}

let store: MemoryStore;

beforeEach(() => {
  store = createMemoryStore();
});

describe("get, put, remove", () => {
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

    expect(await store.get<Item>("clinic", "menu", "m1")).toEqual({ id: "m1", name: "a", tags: ["x"] });
  });

  it("replaces by id and keeps the original list position", async () => {
    await store.put<Item>("clinic", "menu", { id: "a", name: "first" });
    await store.put<Item>("clinic", "menu", { id: "b", name: "second" });
    await store.put<Item>("clinic", "menu", { id: "a", name: "first v2" });
    expect((await store.list<Item>("clinic", "menu")).map((i) => i.name)).toEqual(["first v2", "second"]);
  });

  it("removes an item and treats removing a missing one as a no-op", async () => {
    await store.put<Item>("clinic", "menu", { id: "a", name: "x" });
    await store.remove("clinic", "menu", "a");
    await store.remove("clinic", "menu", "a");
    await store.remove("clinic", "never-created", "a");
    expect(await store.list("clinic", "menu")).toEqual([]);
  });

  it("rejects items without a usable id and unknown namespaces", async () => {
    await expect(store.put("clinic", "menu", { id: "", name: "x" })).rejects.toThrow(TypeError);
    await expect(store.put("clinic", "menu", { name: "x" } as unknown as { id: string })).rejects.toThrow(TypeError);
    await expect(store.put("clinic", "", { id: "a" })).rejects.toThrow(TypeError);
    await expect(store.get("admin" as Namespace, "menu", "a")).rejects.toThrow(TypeError);
  });
});

describe("list", () => {
  beforeEach(async () => {
    await store.put<Item>("platform", "things", { id: "1", name: "a", tags: ["x", "y"], meta: { level: 1 } });
    await store.put<Item>("platform", "things", { id: "2", name: "b", tags: ["x"], meta: { level: 2 } });
    await store.put<Item>("platform", "things", { id: "3", name: "a", meta: { level: 2 } });
  });

  it("returns everything in insertion order without a filter, and [] for an empty collection", async () => {
    expect((await store.list<Item>("platform", "things")).map((i) => i.id)).toEqual(["1", "2", "3"]);
    expect(await store.list("platform", "empty")).toEqual([]);
  });

  it("filters by primitive fields, nested objects and arrays with deep equality", async () => {
    expect((await store.list<Item>("platform", "things", { name: "a" })).map((i) => i.id)).toEqual(["1", "3"]);
    expect((await store.list<Item>("platform", "things", { meta: { level: 2 } })).map((i) => i.id)).toEqual(["2", "3"]);
    expect((await store.list<Item>("platform", "things", { tags: ["x"] })).map((i) => i.id)).toEqual(["2"]);
    expect((await store.list<Item>("platform", "things", { name: "a", meta: { level: 2 } })).map((i) => i.id)).toEqual(["3"]);
  });

  it("ignores undefined filter fields and does not match items missing the field", async () => {
    expect(await store.list<Item>("platform", "things", { name: undefined })).toHaveLength(3);
    expect(await store.list<Item>("platform", "things", { tags: [] })).toEqual([]);
  });
});

describe("isolation", () => {
  it("keeps the same collection and id apart across namespaces and across collections", async () => {
    await store.put<Item>("customer", "records", { id: "x", name: "customer side" });
    await store.put<Item>("platform", "records", { id: "x", name: "platform side" });
    await store.put<Item>("platform", "other", { id: "x", name: "other collection" });

    expect((await store.get<Item>("customer", "records", "x"))!.name).toBe("customer side");
    expect((await store.get<Item>("platform", "records", "x"))!.name).toBe("platform side");
    expect((await store.get<Item>("clinic", "records", "x"))).toBeUndefined();

    await store.remove("platform", "records", "x");
    expect((await store.get<Item>("customer", "records", "x"))!.name).toBe("customer side");
    expect((await store.get<Item>("platform", "other", "x"))!.name).toBe("other collection");
  });

  it("is safe with prototype-looking collection and id names", async () => {
    await store.put<Item>("shared", "__proto__", { id: "__proto__", name: "p" });
    expect((await store.get<Item>("shared", "__proto__", "__proto__"))!.name).toBe("p");
    expect(({} as Record<string, unknown>).name).toBeUndefined();
    expect(Object.keys(store.snapshot().shared)).toEqual(["__proto__"]);
  });
});

describe("snapshot and restore", () => {
  it("round trips through a new store", async () => {
    await store.put<Item>("customer", "records", { id: "a", name: "A", tags: ["t"] });
    await store.put<Item>("clinic", "menu", { id: "b", name: "B" });
    const copy = createMemoryStore(store.snapshot());
    expect(await copy.list("customer", "records")).toEqual([{ id: "a", name: "A", tags: ["t"] }]);
    expect(await copy.list("clinic", "menu")).toEqual([{ id: "b", name: "B" }]);
    expect(await copy.list("platform", "anything")).toEqual([]);
  });

  it("returns a deep copy and restore replaces all content", async () => {
    await store.put<Item>("customer", "records", { id: "a", name: "A", tags: ["t"] });
    const snap = store.snapshot();
    (snap.customer.records.a as Item).name = "mutated";
    expect((await store.get<Item>("customer", "records", "a"))!.name).toBe("A");

    store.restore({ shared: { logs: { l1: { id: "l1", name: "log" } } } });
    expect(await store.list("customer", "records")).toEqual([]);
    expect(await store.list("shared", "logs")).toEqual([{ id: "l1", name: "log" }]);
  });
});

describe("process singleton", () => {
  it("returns the same store and survives a module reload", async () => {
    resetStore();
    const first = getStore();
    await first.put<Item>("shared", "log", { id: "a", name: "kept" });

    vi.resetModules();
    const reloaded = await import("./index");
    expect(reloaded.getStore()).toBe(first);
    expect(await reloaded.getStore().get<Item>("shared", "log", "a")).toEqual({ id: "a", name: "kept" });
  });

  it("resetStore empties the data in place, so existing references stay valid", async () => {
    const held = getStore();
    await held.put<Item>("shared", "log", { id: "a", name: "x" });
    resetStore();
    expect(getStore()).toBe(held);
    expect(await held.list("shared", "log")).toEqual([]);

    resetStore({ clinic: { menu: { m: { id: "m", name: "seeded" } } } });
    expect(await held.get<Item>("clinic", "menu", "m")).toEqual({ id: "m", name: "seeded" });
  });
});
