// Who may be matched (08-compliance.md 2절, Medical Service Act art. 27): only short-term foreign visitors.
// Koreans and foreign residents are answered with TASK_STATE_REJECTED, reason not_eligible_foreign_patient. Pure.
import type { ProcedureRequestV1 } from "../../a2a/schemas";

export const NOT_ELIGIBLE = "not_eligible_foreign_patient";

export type Eligibility = { eligible: true } | { eligible: false; reason: typeof NOT_ELIGIBLE; detail: string };

export function checkEligibility(visitor: ProcedureRequestV1["visitorProfile"]): Eligibility {
  if (visitor.nationality === "KR") {
    return { eligible: false, reason: NOT_ELIGIBLE, detail: "Korean nationals cannot be matched (Medical Service Act art. 27)." };
  }
  if (visitor.residency !== "short_term_visitor") {
    return {
      eligible: false,
      reason: NOT_ELIGIBLE,
      detail: "Only short-term foreign visitors can be matched; foreign residents of Korea are excluded (Medical Service Act art. 27).",
    };
  }
  return { eligible: true };
}
