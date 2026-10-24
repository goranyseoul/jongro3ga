import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_DEMO_NOW, advanceClockHours, clock, resetClock, setClock } from "./clock";
import { getStore, resetStore } from "./store";

const ENV = { ...process.env };

beforeEach(() => {
  resetClock();
  delete process.env.DEMO_NOW;
  process.env.DEMO_MODE = "true";
});

afterEach(() => {
  process.env.DEMO_MODE = ENV.DEMO_MODE;
  if (ENV.DEMO_MODE === undefined) delete process.env.DEMO_MODE;
  if (ENV.DEMO_NOW === undefined) delete process.env.DEMO_NOW;
  else process.env.DEMO_NOW = ENV.DEMO_NOW;
  resetClock();
  vi.useRealTimers();
});

describe("demo clock", () => {
  it("starts at the default day and stays put however long it is read", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2031-01-01T00:00:00Z"));
    expect(clock.nowIso()).toBe(DEFAULT_DEMO_NOW);
    vi.advanceTimersByTime(3 * 60 * 60 * 1000);
    expect(clock.nowIso()).toBe(DEFAULT_DEMO_NOW);
    expect(clock.today()).toBe("2026-10-24");
  });

  it("is a Saturday morning in Seoul, the day the scenarios start from", () => {
    expect(clock.today()).toBe("2026-10-24");
    expect(clock.now().getUTCDay()).toBe(6);
    expect(DEFAULT_DEMO_NOW.endsWith("+09:00")).toBe(true);
  });

  it("starts from DEMO_NOW when it is set", () => {
    process.env.DEMO_NOW = "2026-11-12T10:00:00+09:00";
    expect(clock.today()).toBe("2026-11-12");
  });

  it("moves only through setClock, forward or back, and resets to the start", () => {
    setClock("2026-11-10T13:00:00+09:00");
    expect(clock.nowIso()).toBe("2026-11-10T13:00:00+09:00");
    setClock("2026-10-01T09:30:00+09:00");
    expect(clock.today()).toBe("2026-10-01");
    resetClock();
    expect(clock.nowIso()).toBe(DEFAULT_DEMO_NOW);
  });

  it("advances by hours from the fixed time", () => {
    advanceClockHours(5);
    expect(clock.nowIso()).toBe("2026-10-24T15:00:00+09:00");
    advanceClockHours(24);
    expect(clock.today()).toBe("2026-10-25");
  });

  it("converts to Seoul time: 16:00 UTC is already the next day in Korea", () => {
    setClock("2026-10-24T16:00:00Z");
    expect(clock.today()).toBe("2026-10-25");
    expect(clock.nowIso()).toBe("2026-10-25T01:00:00+09:00");
  });

  it("accepts Date objects and rejects nonsense", () => {
    setClock(new Date("2026-12-10T00:00:00+09:00"));
    expect(clock.today()).toBe("2026-12-10");
    expect(() => setClock("not a date")).toThrow(TypeError);
    expect(clock.today()).toBe("2026-12-10");
  });

  it("follows the real time outside demo mode and ignores setClock there", () => {
    process.env.DEMO_MODE = "false";
    setClock("2000-01-01T00:00:00+09:00");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-03-05T12:00:00Z"));
    expect(clock.now().toISOString()).toBe("2027-03-05T12:00:00.000Z");
  });

  it("shares its state with the store singleton on globalThis.__pibu and survives a module reload", async () => {
    resetStore();
    await getStore().put("shared", "log", { id: "a" });
    setClock("2026-11-10T13:00:00+09:00");
    vi.resetModules();
    const reloaded = await import("./clock");
    expect(reloaded.clock.nowIso()).toBe("2026-11-10T13:00:00+09:00");
    expect(await getStore().get("shared", "log", "a")).toEqual({ id: "a" });
  });
});
