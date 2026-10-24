import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryStore } from "./memory";
import { PERSIST_DELAY_MS, persistEnabled, readPersisted, withPersistence } from "./persist";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "pibu-store-"));
  file = join(dir, "nested", "store.json");
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  rmSync(dir, { recursive: true, force: true });
});

describe("persistEnabled", () => {
  it("is on only with PIBU_PERSIST=true outside production, whatever DEMO_MODE says", () => {
    expect(persistEnabled({ NODE_ENV: "development", PIBU_PERSIST: "true" })).toBe(true);
    expect(persistEnabled({ NODE_ENV: "test", PIBU_PERSIST: "true", DEMO_MODE: "false" })).toBe(true);
    expect(persistEnabled({ NODE_ENV: "production", PIBU_PERSIST: "true" })).toBe(false);
    expect(persistEnabled({ NODE_ENV: "development", DEMO_MODE: "true" })).toBe(false);
    expect(persistEnabled({ NODE_ENV: "development", PIBU_PERSIST: "false" })).toBe(false);
    // the test run itself must never write .data/store.json
    expect(persistEnabled()).toBe(false);
  });
});

describe("withPersistence", () => {
  it("saves once, a second after the last write, and the file restores into a new store", async () => {
    const store = withPersistence(createMemoryStore(), file);
    await store.put("clinic", "slots", { id: "s1", held: false });
    vi.advanceTimersByTime(PERSIST_DELAY_MS - 1);
    await store.put("clinic", "slots", { id: "s2", held: true });
    vi.advanceTimersByTime(PERSIST_DELAY_MS - 1);
    expect(existsSync(file)).toBe(false);

    vi.advanceTimersByTime(1);
    const saved = readPersisted(file)!;
    expect(Object.keys(saved.clinic.slots!)).toEqual(["s1", "s2"]);

    await store.remove("clinic", "slots", "s1");
    store.flush();
    const restored = createMemoryStore(readPersisted(file));
    expect(await restored.list("clinic", "slots")).toEqual([{ id: "s2", held: true }]);
  });

  it("saves after restore too (seed reset), and reads stay untouched", async () => {
    const store = withPersistence(createMemoryStore(), file);
    store.restore({ platform: { rules: { r1: { id: "r1" } } } });
    expect(await store.get("platform", "rules", "r1")).toEqual({ id: "r1" });
    vi.advanceTimersByTime(PERSIST_DELAY_MS);
    expect(JSON.parse(readFileSync(file, "utf8")).platform.rules.r1).toEqual({ id: "r1" });
  });
});

describe("readPersisted", () => {
  it("returns undefined for a missing, corrupt or foreign file so the seed loads instead", () => {
    expect(readPersisted(join(dir, "missing.json"))).toBeUndefined();
    const corrupt = join(dir, "corrupt.json");
    writeFileSync(corrupt, "{ not json");
    expect(readPersisted(corrupt)).toBeUndefined();
    const foreign = join(dir, "foreign.json");
    writeFileSync(foreign, JSON.stringify({ customer: {}, platform: {} }));
    expect(readPersisted(foreign)).toBeUndefined();
  });
});
