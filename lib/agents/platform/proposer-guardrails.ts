// Server-side validation of rule drafts (07-platform-intelligence.md section 4 "가드레일"). Every draft,
// whether it came from the deterministic triggers or from Claude, passes through screenDraft before it
// can be stored. Claude output is untrusted input: unknown fields are not stripped, they reject the draft.
import { z } from "zod";
import { AgeBandSchema, AreaSchema, KrwSchema, LocaleSchema, NationalitySchema } from "../../a2a/schemas";
import type { Outcome, RuleAction, RuleCondition, Signal } from "../../domain/platform";

/** Health information must never be a rule condition (guardrail 2). */
const HEALTH_KEY = /(safety|health|medical|pregnan|breastfeed|allerg|anticoag|isotretinoin|keloid|skin|diagnos|disease|symptom|medication|blood|bmi|weight)/i;
/** Prices may never differ by nationality (guardrail 1). */
const PRICING_KEY = /(price|pricing|discount|surcharge|markup|fee|tariff|charge|multiplier|krw)/i;

export const RuleConditionSchema = z.strictObject({
  procedureIds: z.array(z.string().min(1)).min(1).optional(),
  nationalities: z.array(NationalitySchema).min(1).optional(),
  languages: z.array(LocaleSchema).min(1).optional(),
  areas: z.array(AreaSchema).min(1).optional(),
  ageBands: z.array(AgeBandSchema).min(1).optional(),
  firstKProcedure: z.boolean().optional(),
  budgetMaxBelowKrw: KrwSchema.optional(),
});

const ClinicIds = z.array(z.string().regex(/^cln_[A-Za-z0-9_]+$/)).min(1);
const Delta = z.number().gt(0).max(0.3);

export const RuleActionSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("exclude_clinic"), clinicIds: ClinicIds }),
  z.strictObject({ kind: z.literal("boost_clinic"), clinicIds: ClinicIds, delta: Delta }),
  z.strictObject({ kind: z.literal("demote_clinic"), clinicIds: ClinicIds, delta: Delta }),
  z.strictObject({ kind: z.literal("prefer_area"), areas: z.array(AreaSchema).min(1), delta: Delta }),
  z.strictObject({ kind: z.literal("require_language"), languages: z.array(LocaleSchema).min(1) }),
]);

export const RuleDraftSchema = z.strictObject({
  /** Set when the draft rewrites a deterministic candidate; absent for an extra pattern. */
  candidateKey: z.string().min(1).optional(),
  when: RuleConditionSchema,
  then: RuleActionSchema,
  reason: z.string().min(1).max(500),
  evidence: z.strictObject({
    outcomeIds: z.array(z.string().min(1)),
    signalIds: z.array(z.string().min(1)),
    summary: z.string().min(1).max(300),
  }),
});
export type RuleDraft = z.infer<typeof RuleDraftSchema>;

/** Input of the forced tool call. Items stay unknown here so each one is screened on its own. */
export const ProposeRulesInputSchema = z.object({ rules: z.array(z.unknown()) });

export const PROPOSE_RULES_TOOL = {
  name: "propose_rules",
  description:
    "Write the Korean reason and evidence summary for each candidate rule (keep candidateKey, when and then unchanged), and optionally add at most 2 extra rules for patterns the candidates miss. Extra rules must cite outcomeIds. Never use health information or nationality based pricing.",
  inputSchema: z.toJSONSchema(z.object({ rules: z.array(RuleDraftSchema).max(12) })) as Record<string, unknown>,
};

export type DropReason =
  | "invalid_shape"
  | "forbidden_health_condition"
  | "forbidden_nationality_pricing"
  | "nationality_preference"
  | "nationality_without_harm"
  | "unknown_clinic"
  | "unknown_outcome"
  | "unknown_signal"
  | "missing_evidence";

export interface ScreenContext {
  clinicIds: ReadonlySet<string>;
  outcomes: ReadonlyMap<string, Outcome>;
  signals: ReadonlyMap<string, Signal>;
}

export type ScreenResult = { ok: true; draft: RuleDraft } | { ok: false; reason: DropReason; detail: string };

const ALLOWED_TOP = new Set(["candidateKey", "when", "then", "reason", "evidence"]);
const ALLOWED_WHEN = new Set(Object.keys(RuleConditionSchema.shape));
const ALLOWED_THEN = new Set(["kind", "clinicIds", "delta", "areas", "languages"]);
const ACTION_KINDS = new Set(["exclude_clinic", "boost_clinic", "demote_clinic", "prefer_area", "require_language"]);

function unknownKeys(value: unknown, allowed: ReadonlySet<string>): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.keys(value).filter((key) => !allowed.has(key));
}

/** Names of every key below `value`, for spotting a health field nested anywhere. */
function deepKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((item) => deepKeys(item, out));
  else if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      out.push(key);
      deepKeys(child, out);
    }
  }
  return out;
}

const HARM_SIGNALS = new Set<Signal["kind"]>(["quote_gap", "low_satisfaction", "side_effect_report", "response_timeout", "rejection", "no_show"]);

/** An outcome that shows actual harm at a clinic: paid clearly more than quoted, low satisfaction, or side effects. */
function isHarm(outcome: Outcome): boolean {
  return (outcome.quoteGapRatio ?? 0) > 0.1 || outcome.satisfaction <= 2 || outcome.sideEffects.length > 0;
}

export function screenDraft(raw: unknown, ctx: ScreenContext): ScreenResult {
  const record = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;

  // 1. Forbidden fields first, so the drop reason names the guardrail and not just "bad shape".
  const extraKeys = [
    ...unknownKeys(record, ALLOWED_TOP),
    ...unknownKeys(record.when, ALLOWED_WHEN),
    ...unknownKeys(record.then, ALLOWED_THEN),
  ];
  // Known field names never match HEALTH_KEY, so scanning every key under when/then only catches extras.
  const health = [...extraKeys, ...deepKeys(record.when), ...deepKeys(record.then)].find((key) => HEALTH_KEY.test(key));
  if (health) return { ok: false, reason: "forbidden_health_condition", detail: `health field "${health}" cannot be a rule condition` };
  const kind = (record.then as { kind?: unknown } | undefined)?.kind;
  const pricing = extraKeys.find((key) => PRICING_KEY.test(key)) ?? (typeof kind === "string" && PRICING_KEY.test(kind) ? kind : undefined);
  if (pricing) return { ok: false, reason: "forbidden_nationality_pricing", detail: `pricing field "${pricing}" is not allowed in a rule` };
  if (typeof kind === "string" && !ACTION_KINDS.has(kind)) return { ok: false, reason: "invalid_shape", detail: `unknown action kind "${kind}"` };

  // 2. Exact shape.
  const parsed = RuleDraftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid_shape", detail: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
  const draft = parsed.data;

  // 3. References must exist.
  const clinicIds = "clinicIds" in draft.then ? draft.then.clinicIds : [];
  const unknownClinic = clinicIds.find((id) => !ctx.clinicIds.has(id));
  if (unknownClinic) return { ok: false, reason: "unknown_clinic", detail: `clinic ${unknownClinic} is not in the registry` };
  const unknownOutcome = draft.evidence.outcomeIds.find((id) => !ctx.outcomes.has(id));
  if (unknownOutcome) return { ok: false, reason: "unknown_outcome", detail: `outcome ${unknownOutcome} does not exist` };
  const unknownSignal = draft.evidence.signalIds.find((id) => !ctx.signals.has(id));
  if (unknownSignal) return { ok: false, reason: "unknown_signal", detail: `signal ${unknownSignal} does not exist` };

  // 4. Nationality only for language or area preference, or to exclude a clinic where that nationality was harmed.
  const nationalities = draft.when.nationalities;
  if (nationalities?.length) {
    if (draft.then.kind === "boost_clinic") {
      return { ok: false, reason: "nationality_preference", detail: "a nationality condition cannot favor a clinic" };
    }
    if (draft.then.kind === "exclude_clinic" || draft.then.kind === "demote_clinic") {
      const targets = new Set(draft.then.clinicIds);
      const harmed = draft.evidence.outcomeIds.some((id) => {
        const outcome = ctx.outcomes.get(id);
        return outcome !== undefined && targets.has(outcome.clinicId) && nationalities.includes(outcome.visitorProfile.nationality) && isHarm(outcome);
      });
      const signalled = draft.evidence.signalIds.some((id) => {
        const signal = ctx.signals.get(id);
        return signal !== undefined && targets.has(signal.clinicId) && HARM_SIGNALS.has(signal.kind);
      });
      if (!harmed && !signalled) {
        return { ok: false, reason: "nationality_without_harm", detail: "no outcome or signal shows harm to that nationality at that clinic" };
      }
    }
  }

  return { ok: true, draft };
}

/** Order-insensitive identity of a rule's condition and action, for spotting duplicates. */
export function ruleSignature(when: RuleCondition, then: RuleAction): string {
  const norm = (value: unknown): unknown => {
    if (Array.isArray(value)) return [...value].map(norm).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (typeof value === "object" && value !== null) {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, child]) => child !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, child]) => [key, norm(child)]),
      );
    }
    return value;
  };
  return JSON.stringify({ when: norm(when), then: norm(then) });
}
