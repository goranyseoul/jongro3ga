import { z } from "zod";
import { AgeBandSchema, AreaSchema, KrwSchema, LocaleSchema, NationalitySchema } from "../../a2a/schemas";

// propose_rules (07 4절 proposer 2단계). The schema mirrors RoutingRule's `when` (RuleCondition) and `then`
// (RuleAction) of lib/domain/platform.ts. The server then drops what the guardrails forbid even if a draft
// reached it in another shape:
//   1. nationality may not change prices (no rule changes prices at all), and
//   2. health information (safety, skin) is never a rule condition.
// Drafts that name a clinic that does not exist are dropped too.

export const RuleConditionSchema = z.strictObject({
  procedureIds: z.array(z.string().min(1)).optional(),
  nationalities: z.array(NationalitySchema).optional(),
  languages: z.array(LocaleSchema).optional(),
  areas: z.array(AreaSchema).optional(),
  ageBands: z.array(AgeBandSchema).optional(),
  firstKProcedure: z.boolean().optional(),
  budgetMaxBelowKrw: KrwSchema.optional(),
});

const clinicIds = z.array(z.string().regex(/^cln_[A-Za-z0-9_]+$/)).min(1);
const delta = z.number().positive().max(1);

export const RuleActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("exclude_clinic"), clinicIds }),
  z.strictObject({ kind: z.literal("boost_clinic"), clinicIds, delta }),
  z.strictObject({ kind: z.literal("demote_clinic"), clinicIds, delta }),
  z.strictObject({ kind: z.literal("prefer_area"), areas: z.array(AreaSchema).min(1), delta }),
  z.strictObject({ kind: z.literal("require_language"), languages: z.array(LocaleSchema).min(1) }),
]);

export const RoutingRuleDraftSchema = z.strictObject({
  when: RuleConditionSchema,
  then: RuleActionSchema,
  /** One Korean line for the ops console, e.g. "견적 대비 실결제 평균 +31% (n=20)". */
  reason: z.string().trim().min(1),
  evidence: z.strictObject({
    outcomeIds: z.array(z.string().min(1)),
    signalIds: z.array(z.string().min(1)),
    summary: z.string().trim().min(1),
  }),
  /** "trigger" = a stage 1 candidate, "pattern" = an extra pattern Claude found (at most 2, outcomeIds required). */
  origin: z.enum(["trigger", "pattern"]),
  /** exclude_clinic defaults to 90 (guardrail 3). */
  expiresInDays: z.number().int().positive().optional(),
  /** Side effect trigger (07: 긴급 표시). */
  urgent: z.boolean().optional(),
});

export const ProposeRulesInputSchema = z.strictObject({ rules: z.array(RoutingRuleDraftSchema) });

export type RuleConditionDraft = z.infer<typeof RuleConditionSchema>;
export type RuleActionDraft = z.infer<typeof RuleActionSchema>;
export type RoutingRuleDraft = z.infer<typeof RoutingRuleDraftSchema>;

export type RuleRejection =
  | "health_condition"
  | "nationality_pricing"
  | "unknown_clinic"
  | "pattern_without_outcomes"
  | "too_many_patterns"
  | "invalid";

export interface SanitizedRules {
  accepted: RoutingRuleDraft[];
  rejected: { draft: unknown; reason: RuleRejection; detail: string }[];
}

/** Profile fields that carry health information (06 CustomerProfile.safety and .skin, the wire safetyInfo). */
const HEALTH_KEYS = new Set([
  "safety",
  "safetyInfo",
  "skin",
  "skinType",
  "concerns",
  "pregnantOrBreastfeeding",
  "pregnant",
  "allergies",
  "anticoagulants",
  "recentIsotretinoin",
  "keloidHistory",
  "health",
  "medicalHistory",
  "conditions",
]);

const PRICE_KEY = /price|discount|surcharge|markup|fee|krw/i;
/** The one price related condition the rule engine has, and it is about the request budget, not the visitor. */
const ALLOWED_PRICE_CONDITION = "budgetMaxBelowKrw";

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);

function keysDeep(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(keysDeep);
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([key, inner]) => [key, ...keysDeep(inner)]);
}

const MAX_PATTERNS = 2;

export const EXCLUDE_DEFAULT_EXPIRY_DAYS = 90;

/**
 * Applies 07 guardrails 1 and 2, the clinic existence check and the "at most 2 extra patterns with outcomeIds"
 * rule to raw drafts. Never throws: a draft is either accepted (validated) or listed with the reason.
 */
export function sanitizeRuleDrafts(rawRules: readonly unknown[], options: { knownClinicIds: Iterable<string> }): SanitizedRules {
  const known = new Set(options.knownClinicIds);
  const result: SanitizedRules = { accepted: [], rejected: [] };
  let patterns = 0;

  for (const draft of rawRules) {
    const when = isRecord(draft) ? draft.when : undefined;
    const then = isRecord(draft) ? draft.then : undefined;
    const whenKeys = keysDeep(when);

    const healthKey = whenKeys.find((key) => HEALTH_KEYS.has(key));
    if (healthKey) {
      result.rejected.push({ draft, reason: "health_condition", detail: `health information "${healthKey}" cannot be a rule condition` });
      continue;
    }

    const actionKind = isRecord(then) && typeof then.kind === "string" ? then.kind : "";
    const priceInAction = [actionKind, ...keysDeep(then)].find((key) => key !== "" && PRICE_KEY.test(key));
    const priceInCondition = whenKeys.find((key) => PRICE_KEY.test(key) && key !== ALLOWED_PRICE_CONDITION);
    const hasNationality = isRecord(when) && when.nationalities !== undefined;
    if (priceInAction || (hasNationality && priceInCondition)) {
      result.rejected.push({
        draft,
        reason: "nationality_pricing",
        detail: `rules cannot set prices by nationality ("${priceInAction ?? priceInCondition}")`,
      });
      continue;
    }

    const parsed = RoutingRuleDraftSchema.safeParse(draft);
    if (!parsed.success) {
      result.rejected.push({
        draft,
        reason: "invalid",
        detail: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; "),
      });
      continue;
    }
    const rule = parsed.data;

    const unknownClinic = "clinicIds" in rule.then ? rule.then.clinicIds.find((id) => !known.has(id)) : undefined;
    if (unknownClinic) {
      result.rejected.push({ draft, reason: "unknown_clinic", detail: `no clinic ${unknownClinic} in the registry` });
      continue;
    }

    if (rule.origin === "pattern") {
      if (rule.evidence.outcomeIds.length === 0) {
        result.rejected.push({ draft, reason: "pattern_without_outcomes", detail: "an extra pattern needs outcomeIds" });
        continue;
      }
      if (patterns >= MAX_PATTERNS) {
        result.rejected.push({ draft, reason: "too_many_patterns", detail: `at most ${MAX_PATTERNS} extra patterns` });
        continue;
      }
      patterns += 1;
    }

    const expiresInDays =
      rule.expiresInDays ?? (rule.then.kind === "exclude_clinic" ? EXCLUDE_DEFAULT_EXPIRY_DAYS : undefined);
    result.accepted.push(expiresInDays === undefined ? rule : { ...rule, expiresInDays });
  }
  return result;
}
