import { describe, expect, it } from "vitest";
import type { Locale } from "../../domain";
import { hasBannedComparison, LOCALES } from "./copy-common";
import { buildReasons, MATCHING_COPY, type MatchingCopyKey, type ReasonFacts } from "./matching-copy";

const KEYS = Object.keys(MATCHING_COPY.ko) as MatchingCopyKey[];

const facts = (extra: Partial<ReasonFacts> = {}): ReasonFacts => ({
  topFactors: ["fit", "outcome", "reliability", "price"],
  language: { locale: "ja", mode: "staff" },
  priceBand: "mid",
  outcomes: { n: 8, avgSatisfaction: 4.5 },
  gaps: { n: 8, avgGap: 0 },
  ruleAdjusted: true,
  budgetExceeded: true,
  nearStayArea: "sinsa",
  ...extra,
});

describe("matching copy", () => {
  it("has every key in all four languages, none empty", () => {
    for (const locale of LOCALES) {
      expect(Object.keys(MATCHING_COPY[locale]).sort()).toEqual([...KEYS].sort());
      for (const key of KEYS) expect(MATCHING_COPY[locale][key].trim().length, `${locale}.${key}`).toBeGreaterThan(0);
    }
  });

  it("never compares one clinic with another (08 3절)", () => {
    for (const locale of LOCALES) {
      for (const key of KEYS) expect(hasBannedComparison(MATCHING_COPY[locale][key]), `${locale}.${key}`).toBe(false);
    }
  });

  it("the banned word check is not blind (positive control)", () => {
    for (const sample of ["ここはあそこより良い", "Clinic A is better than clinic B", "A의원이 B의원보다 낫다", "A诊所比B诊所更好"]) {
      expect(hasBannedComparison(sample), sample).toBe(true);
    }
  });

  it("builds two factor sentences, then rule, budget and location sentences, in every language", () => {
    for (const locale of LOCALES) {
      const reasons = buildReasons(facts(), locale as Locale);
      expect(reasons).toHaveLength(5);
      for (const r of reasons) {
        expect(hasBannedComparison(r)).toBe(false);
        expect(r).not.toMatch(/\{\w+\}/);
      }
    }
    expect(buildReasons(facts(), "en")).toEqual([
      "Japanese-speaking staff on site",
      "Average satisfaction 4.5 in 8 past outcomes",
      "Reflects platform operating rules",
      "May exceed your budget",
      "Near where you stay (Sinsa)",
    ]);
  });

  it("skips a factor that has nothing to say and states the gap when quotes were exceeded", () => {
    const reasons = buildReasons(
      facts({ topFactors: ["fit", "reliability", "price", "outcome"], language: { locale: "ko", mode: "app_translation" }, gaps: { n: 4, avgGap: 0.15 }, ruleAdjusted: false, budgetExceeded: false, nearStayArea: undefined }),
      "ko",
    );
    expect(reasons).toEqual(["지난 결과 4건에서 실결제가 견적보다 평균 15% 높았어요", "단위가격이 최근 실결제 기록의 중간 범위예요"]);
  });
});
