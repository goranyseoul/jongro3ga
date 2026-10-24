import { describe, expect, it } from "vitest";
import { checkEligibility } from "./eligibility";

describe("eligibility (08 2절)", () => {
  it("rejects Korean nationals", () => {
    expect(checkEligibility({ nationality: "KR" })).toEqual({ eligible: false, reason: "not_eligible_foreign_patient" });
  });

  it("rejects foreign residents", () => {
    expect(checkEligibility({ nationality: "JP", residency: "resident", ageBand: "25-29" })).toEqual({
      eligible: false,
      reason: "not_eligible_foreign_patient",
    });
  });

  it("lets a Japanese short term visitor through", () => {
    expect(checkEligibility({ nationality: "JP", residency: "short_term_visitor", ageBand: "25-29" })).toEqual({ eligible: true });
  });
});
