// Routing rules (07 2절 "규칙 적용과 결과", 4절). `when` is evaluated against the request only; clinics are
// named only in `then`. Health information cannot appear in a condition (RuleCondition has no such field). Pure.
import type { ProcedureRequestV1 } from "../../a2a/schemas";
import type { RoutingRule, RuleCondition } from "../../domain";

/** Every specified field must match; unspecified fields are wildcards. Array fields match on any overlap. */
export function ruleMatches(when: RuleCondition, request: ProcedureRequestV1): boolean {
  const v = request.visitorProfile;
  if (when.procedureIds && !when.procedureIds.includes(request.procedureId)) return false;
  if (when.nationalities && !when.nationalities.includes(v.nationality)) return false;
  if (when.languages && !when.languages.some((l) => request.languages.includes(l))) return false;
  if (when.areas && !(request.areas ?? []).some((a) => when.areas!.includes(a))) return false;
  if (when.ageBands && !(v.ageBand !== undefined && when.ageBands.includes(v.ageBand))) return false;
  if (when.firstKProcedure !== undefined && v.firstKProcedure !== when.firstKProcedure) return false;
  if (when.budgetMaxBelowKrw !== undefined && !(request.budgetKrw !== undefined && request.budgetKrw.max < when.budgetMaxBelowKrw)) {
    return false;
  }
  return true;
}

/** Active and not expired at `nowIso`. */
export function isRuleActive(rule: RoutingRule, nowIso: string): boolean {
  if (rule.status !== "active") return false;
  if (rule.expiresAt && Date.parse(rule.expiresAt) <= Date.parse(nowIso)) return false;
  return true;
}

const KIND_ORDER: Record<RoutingRule["then"]["kind"], number> = {
  require_language: 0,
  exclude_clinic: 1,
  boost_clinic: 2,
  demote_clinic: 2,
  prefer_area: 2,
};

/** Rules that apply to this request, in application order: require_language, exclude, then adjustments; id within a step. */
export function applicableRules(rules: readonly RoutingRule[], request: ProcedureRequestV1, nowIso: string): RoutingRule[] {
  return rules
    .filter((r) => isRuleActive(r, nowIso) && ruleMatches(r.when, request))
    .sort((a, b) => KIND_ORDER[a.then.kind] - KIND_ORDER[b.then.kind] || a.id.localeCompare(b.id));
}
