import { describe, expect, it } from "vitest";
import { BANNED_COMPARISONS, hasBannedComparison, LOCALES } from "./copy-common";
import { FAIRNESS_COPY, fairnessExplanation, type FairnessCopyKey } from "./fairness-copy";

const KEYS = Object.keys(FAIRNESS_COPY.ko) as FairnessCopyKey[];

describe("fairness copy", () => {
  it("has every key in all four languages, none empty", () => {
    for (const locale of LOCALES) {
      expect(Object.keys(FAIRNESS_COPY[locale]).sort()).toEqual([...KEYS].sort());
      for (const key of KEYS) expect(FAIRNESS_COPY[locale][key].trim().length, `${locale}.${key}`).toBeGreaterThan(0);
    }
  });

  it("never compares one clinic with another (08 3절)", () => {
    for (const locale of LOCALES) {
      for (const key of KEYS) expect(hasBannedComparison(FAIRNESS_COPY[locale][key]), `${locale}.${key}`).toBe(false);
    }
  });

  it("the banned word check catches each banned phrase (positive control)", () => {
    for (const sample of ["AクリニックはBより良い", "A is better than B", "A가 B보다 낫다", "A比B更好"]) {
      expect(hasBannedComparison(sample), sample).toBe(true);
    }
    expect(BANNED_COMPARISONS).toHaveLength(4);
  });

  it("explanations come in four languages and stay free of comparisons", () => {
    const text = fairnessExplanation({
      amount: { value: 1, unit: "cc" },
      typicalAmount: { min: 2, max: 3 },
      priceBand: "low",
      doseFlag: "below_typical",
      clinicFlags: [{ code: "paid_more_than_quoted", avgGapPct: 15 }, { code: "indicative_price" }],
    });
    expect(Object.keys(text).sort()).toEqual([...LOCALES].sort());
    for (const locale of LOCALES) {
      expect(text[locale]).toBeTruthy();
      expect(hasBannedComparison(text[locale]!)).toBe(false);
      expect(text[locale]).not.toMatch(/\{\w+\}/);
    }
    expect(text.en).toContain("1cc is below the 2~3cc");
  });
});
