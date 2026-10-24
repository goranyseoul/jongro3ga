import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

const FALLBACK = "/clinic/dashboard";

describe("safeNextPath", () => {
  it("keeps same-site paths with query and hash", () => {
    expect(safeNextPath("/clinic/settings", FALLBACK)).toBe("/clinic/settings");
    expect(safeNextPath("/clinic/inbox?tab=booking#top", FALLBACK)).toBe("/clinic/inbox?tab=booking#top");
  });

  it("falls back when next is missing", () => {
    expect(safeNextPath(null, FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath(undefined, FALLBACK)).toBe(FALLBACK);
    expect(safeNextPath("", FALLBACK)).toBe(FALLBACK);
  });

  it("rejects other sites and scheme tricks", () => {
    for (const bad of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "javascript:alert(1)",
      "clinic/settings",
      "/redirect?to=https://evil.example",
      "/ /evil",
    ]) {
      expect(safeNextPath(bad, FALLBACK)).toBe(FALLBACK);
    }
  });

  it("never sends you back to the login page", () => {
    expect(safeNextPath("/clinic/login", FALLBACK, "/clinic/login")).toBe(FALLBACK);
    expect(safeNextPath("/clinic/login?next=/x", FALLBACK, "/clinic/login")).toBe(FALLBACK);
    expect(safeNextPath("/clinic/login-help", FALLBACK, "/clinic/login")).toBe("/clinic/login-help");
  });
});
