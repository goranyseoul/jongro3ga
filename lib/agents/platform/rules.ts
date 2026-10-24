import type { ProcedureRequestV1 } from "../../a2a/schemas";
import { clock } from "../../clock";
import type { Area, ClinicRegistryEntry, RoutingRule, RuleCondition } from "../../domain";
import { clamp, DAY_MS, kstIso } from "./stats";
import { platformStore } from "./store";

// Routing rules, 07 2절 "규칙 적용" and 4절 (lifecycle, guardrails). Evaluation is pure; the lifecycle functions
// at the bottom write through the store adapter. The operator approval flow (/ops/rules, WP7) calls
// activateRule / rejectRule / retireRule.

export const EXCLUDE_DEFAULT_DAYS = 90;
const REVIEW_BEFORE_DAYS = 7;

/** `when` is checked against the request only: every field it sets must match, unset fields are wildcards. */
export function ruleMatches(when: RuleCondition, request: ProcedureRequestV1): boolean {
  const visitor = request.visitorProfile;
  if (when.procedureIds && !when.procedureIds.includes(request.procedureId)) return false;
  if (when.nationalities && !when.nationalities.includes(visitor.nationality)) return false;
  if (when.languages && !when.languages.some((l) => request.languages.includes(l))) return false;
  if (when.areas && !when.areas.some((a) => (request.areas ?? []).includes(a))) return false;
  if (when.ageBands && (visitor.ageBand === undefined || !when.ageBands.includes(visitor.ageBand))) return false;
  if (when.firstKProcedure !== undefined && visitor.firstKProcedure !== when.firstKProcedure) return false;
  if (when.budgetMaxBelowKrw !== undefined && !(request.budgetKrw !== undefined && request.budgetKrw.max < when.budgetMaxBelowKrw)) {
    return false;
  }
  return true;
}

/** Active and not past its expiry. */
export const isLive = (rule: RoutingRule, now: Date): boolean =>
  rule.status === "active" && (rule.expiresAt === undefined || Date.parse(rule.expiresAt) > now.getTime());

/** An active rule within 7 days of expiry, flagged for review on /ops/rules (07 4절 가드레일 3). */
export const needsReview = (rule: RoutingRule, now: Date): boolean =>
  isLive(rule, now) && rule.expiresAt !== undefined && Date.parse(rule.expiresAt) - now.getTime() <= REVIEW_BEFORE_DAYS * DAY_MS;

export interface RuleTarget {
  clinic: Pick<ClinicRegistryEntry, "id" | "area" | "languages">;
  score: number;
}

export type RuleEffect = "boost" | "demote" | "prefer_area";

export interface RuleApplication<T extends RuleTarget> {
  /** Candidates left after exclusions, scores adjusted and clamped to 0..1, input order kept. */
  candidates: (T & { ruleEffects: RuleEffect[] })[];
  /** Live rules whose `when` matched the request, in the order they were applied. */
  appliedRuleIds: string[];
}

const STAGE: Record<RoutingRule["then"]["kind"], number> = {
  require_language: 0,
  exclude_clinic: 1,
  boost_clinic: 2,
  demote_clinic: 2,
  prefer_area: 2,
};

const supports = (clinic: RuleTarget["clinic"], languages: readonly string[]) =>
  clinic.languages.some((l) => languages.includes(l.locale) && (l.mode === "staff" || l.mode === "interpreter"));

/** 07 2절 2: require_language, then exclude_clinic, then boost / demote / prefer_area. Rule id order within a stage. */
export function applyRules<T extends RuleTarget>(
  candidates: readonly T[],
  rules: readonly RoutingRule[],
  request: ProcedureRequestV1,
  now: Date,
): RuleApplication<T> {
  const matched = rules
    .filter((rule) => isLive(rule, now) && ruleMatches(rule.when, request))
    .sort((a, b) => STAGE[a.then.kind] - STAGE[b.then.kind] || a.id.localeCompare(b.id));

  let out = candidates.map((c) => ({ ...c, ruleEffects: [] as RuleEffect[] }));
  for (const rule of matched) {
    const action = rule.then;
    switch (action.kind) {
      case "require_language":
        out = out.filter((c) => supports(c.clinic, action.languages));
        break;
      case "exclude_clinic":
        out = out.filter((c) => !action.clinicIds.includes(c.clinic.id));
        break;
      case "boost_clinic":
      case "demote_clinic": {
        const sign = action.kind === "boost_clinic" ? 1 : -1;
        for (const c of out) {
          if (!action.clinicIds.includes(c.clinic.id)) continue;
          c.score = clamp(c.score + sign * action.delta);
          c.ruleEffects.push(sign > 0 ? "boost" : "demote");
        }
        break;
      }
      case "prefer_area":
        for (const c of out) {
          if (!action.areas.includes(c.clinic.area as Area)) continue;
          c.score = clamp(c.score + action.delta);
          c.ruleEffects.push("prefer_area");
        }
        break;
    }
  }
  return { candidates: out, appliedRuleIds: matched.map((r) => r.id) };
}

// ---- lifecycle (store) ----

export class RuleTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleTransitionError";
  }
}

/** Saves the current version to the history and writes the next version (07 4절 가드레일 5). */
async function nextVersion(rule: RoutingRule, change: Partial<RoutingRule>): Promise<RoutingRule> {
  await platformStore.putRuleHistory({ id: `${rule.id}@v${rule.version}`, replacedAt: clock.nowIso(), value: rule });
  const next: RoutingRule = { ...rule, ...change, version: rule.version + 1 };
  await platformStore.putRule(next);
  return next;
}

async function load(ruleId: string): Promise<RoutingRule> {
  const rule = await platformStore.rule(ruleId);
  if (!rule) throw new RuleTransitionError(`unknown rule ${ruleId}`);
  return rule;
}

/** Operator approval: proposed -> active. exclude_clinic rules expire 90 days after activation by default. */
export async function activateRule(ruleId: string, opts: { approvedBy: string; expiresAt?: string }): Promise<RoutingRule> {
  const rule = await load(ruleId);
  if (rule.status !== "proposed") throw new RuleTransitionError(`rule ${ruleId} is ${rule.status}, only a proposed rule can be activated`);
  const now = clock.now();
  const expiresAt =
    opts.expiresAt ??
    (rule.then.kind === "exclude_clinic" ? kstIso(now.getTime() + EXCLUDE_DEFAULT_DAYS * DAY_MS) : rule.expiresAt);
  return nextVersion(rule, {
    status: "active",
    approvedBy: opts.approvedBy,
    activatedAt: clock.nowIso(),
    ...(expiresAt === undefined ? {} : { expiresAt }),
  });
}

/** Operator rejection: proposed -> rejected. */
export async function rejectRule(ruleId: string, opts: { rejectedBy: string }): Promise<RoutingRule> {
  const rule = await load(ruleId);
  if (rule.status !== "proposed") throw new RuleTransitionError(`rule ${ruleId} is ${rule.status}, only a proposed rule can be rejected`);
  return nextVersion(rule, { status: "rejected", approvedBy: opts.rejectedBy });
}

/** Retirement instead of deletion: active or proposed -> retired. */
export async function retireRule(ruleId: string): Promise<RoutingRule> {
  const rule = await load(ruleId);
  if (rule.status !== "active" && rule.status !== "proposed") {
    throw new RuleTransitionError(`rule ${ruleId} is ${rule.status}, only an active or proposed rule can be retired`);
  }
  return nextVersion(rule, { status: "retired" });
}

/** Counts one more application per rule (not a rule change, so no new version). */
export async function countApplied(ruleIds: readonly string[]): Promise<void> {
  for (const id of ruleIds) {
    const rule = await platformStore.rule(id);
    if (rule) await platformStore.putRule({ ...rule, appliedCount: rule.appliedCount + 1 });
  }
}
