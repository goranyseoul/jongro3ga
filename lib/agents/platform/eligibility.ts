import type { ProcedureRequestV1 } from "../../a2a/schemas";

// Who the platform may match (08-compliance.md 2절, Medical Act art. 27(3)): only foreign nationals on a short
// visit. Koreans and foreign residents get no matching, booking or referral token.

export const NOT_ELIGIBLE = "not_eligible_foreign_patient";

export type Eligibility = { eligible: true } | { eligible: false; reason: typeof NOT_ELIGIBLE };

export function checkEligibility(visitor: ProcedureRequestV1["visitorProfile"]): Eligibility {
  if (visitor.nationality === "KR") return { eligible: false, reason: NOT_ELIGIBLE };
  if (visitor.residency === "resident") return { eligible: false, reason: NOT_ELIGIBLE };
  return { eligible: true };
}
