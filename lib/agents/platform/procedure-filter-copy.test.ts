import { describe, expect, it } from "vitest";
import type { Locale } from "../../domain/common";
import { filterProcedures } from "./procedure-filter";
import { stayExtensionNotice } from "./procedure-filter-copy";

const LOCALES: Locale[] = ["ko", "ja", "en", "zh-CN"];
const overlap = { code: "downtime_may_overlap_departure", latestEnd: "2026-11-13", departure: "2026-11-10", daysOver: 3, suggestion: "check_stay_extension" } as const;
const cannotFinish = { code: "downtime_after_departure", earliestEnd: "2026-11-10", departure: "2026-11-09", extendDays: 2, suggestion: "check_stay_extension" } as const;

// built from code points so this file carries no banned characters itself
const DASHES = new RegExp(`[${String.fromCodePoint(0x2013)}${String.fromCodePoint(0x2014)}]`);

describe("stay extension notice", () => {
  it("has a sentence in every language that carries the number of days", () => {
    for (const locale of LOCALES) {
      expect(stayExtensionNotice(overlap, locale), locale).toContain("3");
      expect(stayExtensionNotice(cannotFinish, locale), locale).toContain("2");
    }
  });

  it("tells the visitor to check an extension, in each language", () => {
    expect(stayExtensionNotice(overlap, "ko")).toContain("연장");
    expect(stayExtensionNotice(overlap, "ja")).toContain("延長");
    expect(stayExtensionNotice(overlap, "en")).toMatch(/extend your stay/);
    expect(stayExtensionNotice(overlap, "zh-CN")).toContain("延长");
    expect(stayExtensionNotice(cannotFinish, "ko")).toContain("확인");
  });

  it("separates the two cases: may run over versus cannot finish", () => {
    for (const locale of LOCALES) {
      expect(stayExtensionNotice(overlap, locale)).not.toBe(stayExtensionNotice(cannotFinish, locale));
    }
    expect(stayExtensionNotice(overlap, "ko")).toContain("넘길 수 있어요");
    expect(stayExtensionNotice(cannotFinish, "ko")).toContain("끝나지 않아요");
  });

  it("uses the singular for one day in English", () => {
    expect(stayExtensionNotice({ ...cannotFinish, extendDays: 1 }, "en")).toContain("by 1 day.");
    expect(stayExtensionNotice({ ...overlap, daysOver: 1 }, "en")).toContain("up to 1 day past");
    expect(stayExtensionNotice({ ...overlap, daysOver: 2 }, "en")).toContain("up to 2 days past");
  });

  it("stays silent for every other warning and exclusion", () => {
    expect(stayExtensionNotice({ code: "downtime_unknown" }, "ko")).toBeUndefined();
    expect(stayExtensionNotice({ code: "over_budget" }, "en")).toBeUndefined();
    expect(stayExtensionNotice({ code: "avoid_part", part: "under_eye", reason: "x" }, "ja")).toBeUndefined();
    expect(stayExtensionNotice({ code: "series_too_close", intervalDays: 30, visitGapDays: 120 }, "zh-CN")).toBeUndefined();
  });

  it("contains no medical advice words, no dashes and no emoji", () => {
    const banned = /(권유|진단|처방|diagnos|prescrib|治疗建议|診断)/i;
    for (const locale of LOCALES) {
      for (const item of [overlap, cannotFinish]) {
        const text = stayExtensionNotice(item, locale)!;
        expect(text, locale).not.toMatch(banned);
        expect(text, locale).not.toMatch(DASHES);
        expect(text, locale).not.toMatch(/\p{Extended_Pictographic}/u);
      }
    }
  });

  it("works end to end on a real filter result", () => {
    const result = filterProcedures(
      { areas: ["volume"], parts: ["nasolabial"], trip: { arrival: "2026-11-08", departure: "2026-11-10" } },
      {},
    );
    const notices = result.ranked.flatMap((card) => card.warnings.map((w) => stayExtensionNotice(w, "ko")).filter(Boolean));
    expect(notices).toHaveLength(3);
    expect(notices[0]).toContain("3일");
    const tooShort = filterProcedures({ areas: ["volume"], trip: { arrival: "2026-11-08", departure: "2026-11-08" } }, {});
    expect(tooShort.excluded.flatMap((e) => e.reasons.map((r) => stayExtensionNotice(r, "ko")))[0]).toContain("2일");
  });
});
