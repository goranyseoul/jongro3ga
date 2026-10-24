import { describe, expect, it } from "vitest";
import { resolveNext } from "./next-path";

describe("resolveNext", () => {
  it("falls back to home without a usable next", () => {
    expect(resolveNext(undefined)).toEqual({ pathname: "/home" });
    expect(resolveNext("")).toEqual({ pathname: "/home" });
    expect(resolveNext("records")).toEqual({ pathname: "/home" });
  });

  it("rejects paths that leave the site", () => {
    for (const bad of ["//evil.example", "https://evil.example", "/\\evil.example", "/\tevil", "javascript:alert(1)"]) {
      expect(resolveNext(bad)).toEqual({ pathname: "/home" });
    }
  });

  it("keeps a same-site path with its query", () => {
    expect(resolveNext("/records?tab=plan")).toEqual({ pathname: "/records?tab=plan", locale: undefined });
  });

  it("splits off a locale segment", () => {
    expect(resolveNext("/ko/records")).toEqual({ pathname: "/records", locale: "ko" });
    expect(resolveNext("/zh-CN")).toEqual({ pathname: "/", locale: "zh-CN" });
  });

  it("never loops back to login or signup", () => {
    expect(resolveNext("/login")).toEqual({ pathname: "/home", locale: undefined });
    expect(resolveNext("/ja/signup")).toEqual({ pathname: "/home", locale: "ja" });
  });
});
