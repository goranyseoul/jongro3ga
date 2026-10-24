import { clock } from "../../clock";
import type { Area, ClinicRegistryEntry, MatchLog, Outcome, RoutingRule, RuleAction, RuleCondition } from "../../domain";
import { RuleActionSchema, RuleConditionSchema } from "../../store/seed-schemas";
import { EXCLUDE_DEFAULT_DAYS } from "./rules";
import { DAY_MS, kstIso, mean, regionGroupOf, round, withinDays, type RegionGroup } from "./stats";
import { platformStore, type PlatformSignal } from "./store";

// Rule proposals, 07 4절 proposer stage 1: deterministic triggers over the last 30 days per clinic x nationality,
// Korean template reasons, guardrails, stored as `proposed` for an operator to approve on /ops/rules.
// Stage 2 (Claude writes the reasons and adds up to two patterns) comes with lib/llm; its drafts go through the
// same `validateRuleDraft` via `proposeRules({ drafts })`.

export const TRIGGER_WINDOW_DAYS = 30;
const MIN_SEGMENT = 5;
const MIN_AREA_GROUP = 8;
export const PROPOSER_ID = "proposer_v1";

export interface RuleDraft {
  when: unknown;
  then: unknown;
  /** Korean, for the operator. */
  reason: string;
  evidence: { outcomeIds: string[]; signalIds: string[]; summary: string };
  expiresAt?: string;
  /** Side effect trigger: shown as urgent, and the clinic is suspended without waiting for approval. */
  urgent?: boolean;
}

// ---- guardrails ----

/** Health information may never be a rule condition (07 4절 가드레일 2). */
const HEALTH_KEY = /safety|skin|pregnan|allerg|anticoag|isotretinoin|keloid|health|medical|condition|concern/i;
/** Nationality specific prices are forbidden (07 4절 가드레일 1). */
const PRICE_KEY = /price|discount|krw|fee|surcharge/i;

const keysDeep = (value: unknown): string[] =>
  value && typeof value === "object" ? Object.entries(value).flatMap(([k, v]) => [k, ...keysDeep(v)]) : [];

export type DraftCheck = { ok: true; when: RuleCondition; then: RuleAction } | { ok: false; errors: string[] };

/**
 * The server side check every proposed rule passes, deterministic or from Claude: known condition fields only,
 * no health information, no prices, only existing clinics, and nationality may only exclude or demote a clinic
 * with evidence of harm in that nationality.
 */
export function validateRuleDraft(draft: RuleDraft, known: { clinicIds: ReadonlySet<string> }): DraftCheck {
  const errors: string[] = [];
  const whenKeys = keysDeep(draft.when);
  if (whenKeys.some((k) => HEALTH_KEY.test(k))) errors.push("health_information: health fields cannot be rule conditions");
  // Conditions are a closed set (budgetMaxBelowKrw reads the request's budget); actions may never carry a price.
  if (keysDeep(draft.then).some((k) => PRICE_KEY.test(k))) errors.push("nationality_price: rules cannot set prices");
  const when = RuleConditionSchema.safeParse(draft.when);
  if (!when.success) errors.push(`invalid_condition: ${when.error.issues.map((i) => i.message).join("; ")}`);
  const then = RuleActionSchema.safeParse(draft.then);
  if (!then.success) errors.push(`invalid_action: ${then.error.issues.map((i) => i.message).join("; ")}`);
  if (then.success && "clinicIds" in then.data) {
    for (const id of then.data.clinicIds) if (!known.clinicIds.has(id)) errors.push(`unknown_clinic: ${id}`);
  }
  if (when.success && then.success && when.data.nationalities && (then.data.kind === "exclude_clinic" || then.data.kind === "demote_clinic")) {
    if (draft.evidence.outcomeIds.length === 0 && draft.evidence.signalIds.length === 0) {
      errors.push("nationality_without_harm: a nationality condition may only exclude or demote with evidence");
    }
  }
  if (errors.length > 0 || !when.success || !then.success) return { ok: false, errors };
  return { ok: true, when: when.data, then: then.data };
}

// ---- triggers (pure) ----

const NATIONALITY_KO: Record<string, string> = { JP: "일본", CN: "중국", US: "미국", TW: "대만", KR: "한국" };
const natKo = (code: string) => NATIONALITY_KO[code] ?? code;
const REGION_KO: Record<RegionGroup, string> = { gangnam_sinsa: "강남·신사", myeongdong: "명동", hongdae: "홍대", other: "기타" };
const REGION_AREAS: Record<RegionGroup, Area[]> = {
  gangnam_sinsa: ["gangnam", "sinsa", "apgujeong"],
  myeongdong: ["myeongdong"],
  hongdae: ["hongdae"],
  other: ["other"],
};
const pct = (ratio: number) => Math.round(ratio * 100);

export interface TriggerInput {
  outcomes: readonly Outcome[];
  signals: readonly PlatformSignal[];
  matchLogs: readonly MatchLog[];
  registry: readonly ClinicRegistryEntry[];
  now: Date;
}

const groupBy = <T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> => {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    out.set(k, [...(out.get(k) ?? []), item]);
  }
  return new Map([...out.entries()].sort(([a], [b]) => a.localeCompare(b)));
};

/** 07 4절 결정론 트리거 5종. Pure: drafts in a fixed order (trigger, then clinic, then nationality). */
export function evaluateTriggers(input: TriggerInput): RuleDraft[] {
  const { now } = input;
  const recent = input.outcomes.filter((o) => withinDays(o.submittedAt, now, TRIGGER_WINDOW_DAYS));
  const recentSignals = input.signals.filter((s) => withinDays(s.at, now, TRIGGER_WINDOW_DAYS));
  const nameOf = (clinicId: string) => input.registry.find((c) => c.id === clinicId)?.name.ko ?? clinicId;
  const areaOf = (clinicId: string) => input.registry.find((c) => c.id === clinicId)?.area ?? "other";
  const expires = kstIso(now.getTime() + EXCLUDE_DEFAULT_DAYS * DAY_MS);
  const segments = groupBy(recent, (o) => `${o.clinicId}|${o.visitorProfile.nationality}`);
  const drafts: RuleDraft[] = [];

  // 1. paid more than quoted: mean gap > 0.20, n >= 5 -> exclude for that nationality, 90 days
  for (const [key, list] of segments) {
    const [clinicId, nat] = key.split("|");
    const withGap = list.filter((o) => o.quoteGapRatio !== undefined);
    const avg = round(mean(withGap.map((o) => o.quoteGapRatio as number)), 6);
    if (withGap.length < MIN_SEGMENT || avg <= 0.2) continue;
    const basis = `견적 대비 실결제 평균 +${pct(avg)}% (n=${withGap.length})`;
    drafts.push({
      when: { nationalities: [nat] },
      then: { kind: "exclude_clinic", clinicIds: [clinicId] },
      reason: `${nameOf(clinicId)} · ${natKo(nat)} 고객 · 매칭 제외 · 근거: ${basis}`,
      evidence: { outcomeIds: withGap.map((o) => o.id), signalIds: [], summary: `${basis}, 최근 ${TRIGGER_WINDOW_DAYS}일` },
      expiresAt: expires,
    });
  }

  // 2. low satisfaction share > 0.4, n >= 5 -> demote 0.2
  for (const [key, list] of segments) {
    const [clinicId, nat] = key.split("|");
    const low = list.filter((o) => o.satisfaction <= 2);
    if (list.length < MIN_SEGMENT || low.length / list.length <= 0.4) continue;
    const basis = `만족도 2점 이하 ${pct(low.length / list.length)}% (n=${list.length})`;
    drafts.push({
      when: { nationalities: [nat] },
      then: { kind: "demote_clinic", clinicIds: [clinicId], delta: 0.2 },
      reason: `${nameOf(clinicId)} · ${natKo(nat)} 고객 · 추천 순위 낮춤 · 근거: ${basis}`,
      evidence: { outcomeIds: low.map((o) => o.id), signalIds: [], summary: `${basis}, 최근 ${TRIGGER_WINDOW_DAYS}일` },
    });
  }

  // 3. no response: timeouts / referrals > 0.5 with n (referrals) >= 5 -> demote 0.15
  const referrals = new Map<string, number>();
  for (const log of input.matchLogs) {
    if (!withinDays(log.at, now, TRIGGER_WINDOW_DAYS)) continue;
    for (const c of log.result.candidates) {
      const key = `${c.clinicId}|${log.request.visitorProfile.nationality}`;
      referrals.set(key, (referrals.get(key) ?? 0) + 1);
    }
  }
  const timeouts = groupBy(
    recentSignals.filter((s) => s.kind === "response_timeout" && s.context.nationality),
    (s) => `${s.clinicId}|${s.context.nationality}`,
  );
  for (const [key, list] of timeouts) {
    const [clinicId, nat] = key.split("|");
    const n = referrals.get(key) ?? 0;
    if (n < MIN_SEGMENT || list.length / n <= 0.5) continue;
    const basis = `응답 시간초과 ${pct(list.length / n)}% (n=${n})`;
    drafts.push({
      when: { nationalities: [nat] },
      then: { kind: "demote_clinic", clinicIds: [clinicId], delta: 0.15 },
      reason: `${nameOf(clinicId)} · ${natKo(nat)} 고객 · 추천 순위 낮춤 · 근거: ${basis}`,
      evidence: { outcomeIds: [], signalIds: list.map((s) => s.id), summary: `${basis}, 최근 ${TRIGGER_WINDOW_DAYS}일` },
    });
  }

  // 4. area preference: within a nationality, region groups (n >= 8 each) whose mean satisfaction differs by >= 0.8
  for (const [nat, list] of groupBy(recent, (o) => o.visitorProfile.nationality)) {
    const groups = [...groupBy(list, (o) => regionGroupOf(areaOf(o.clinicId)))]
      .filter(([, g]) => g.length >= MIN_AREA_GROUP)
      .map(([region, g]) => ({ region: region as RegionGroup, n: g.length, avg: mean(g.map((o) => o.satisfaction)), ids: g.map((o) => o.id) }))
      .sort((a, b) => b.avg - a.avg || a.region.localeCompare(b.region));
    if (groups.length < 2) continue;
    const best = groups[0];
    const worst = groups[groups.length - 1];
    const diff = round(best.avg - worst.avg, 2);
    if (diff < 0.8) continue;
    const basis = `지역별 평균 만족도 차이 ${diff.toFixed(1)}점 (${REGION_KO[best.region]} n=${best.n}, ${REGION_KO[worst.region]} n=${worst.n})`;
    drafts.push({
      when: { nationalities: [nat] },
      then: { kind: "prefer_area", areas: REGION_AREAS[best.region], delta: 0.1 },
      reason: `${natKo(nat)} 고객 · ${REGION_KO[best.region]} 지역 우선 · 근거: ${basis}`,
      evidence: { outcomeIds: [...best.ids, ...worst.ids], signalIds: [], summary: `${basis}, 최근 ${TRIGGER_WINDOW_DAYS}일` },
    });
  }

  // 5. side effects: >= 2 reports at a clinic, all nationalities -> exclude everywhere, urgent
  for (const [clinicId, list] of groupBy(recentSignals.filter((s) => s.kind === "side_effect_report"), (s) => s.clinicId)) {
    if (list.length < 2) continue;
    const basis = `부작용 보고 ${list.length}건 (최근 ${TRIGGER_WINDOW_DAYS}일)`;
    drafts.push({
      when: {},
      then: { kind: "exclude_clinic", clinicIds: [clinicId] },
      reason: `[긴급] ${nameOf(clinicId)} · 전체 고객 · 매칭 제외 · 근거: ${basis}`,
      evidence: {
        outcomeIds: list.flatMap((s) => (s.context.outcomeId ? [s.context.outcomeId] : [])),
        signalIds: list.map((s) => s.id),
        summary: basis,
      },
      expiresAt: expires,
      urgent: true,
    });
  }
  return drafts;
}

// ---- adapter ----

/** Same action on the same targets under the same condition. */
const sameRule = (a: { when: RuleCondition; then: RuleAction }, b: { when: RuleCondition; then: RuleAction }) =>
  JSON.stringify(a.when) === JSON.stringify(b.when) && JSON.stringify(a.then) === JSON.stringify(b.then);

export interface ProposalResult {
  proposed: RoutingRule[];
  discarded: { draft: RuleDraft; errors: string[] }[];
  /** Clinics suspended right away by an urgent side effect trigger (07 4절 가드레일 4). */
  suspended: string[];
}

/**
 * Runs the triggers (plus any `drafts`, e.g. from Claude later), drops what fails the guardrails or repeats a
 * proposed or active rule, and stores the rest as `proposed`. The operator approves with activateRule.
 */
export async function proposeRules(opts: { drafts?: RuleDraft[]; proposedBy?: string } = {}): Promise<ProposalResult> {
  const now = clock.now();
  const [outcomes, signals, matchLogs, registry, rules, history] = await Promise.all([
    platformStore.outcomes(),
    platformStore.signals(),
    platformStore.matchLogs(),
    platformStore.registry(),
    platformStore.rules(),
    platformStore.ruleHistory(),
  ]);
  const drafts = [...evaluateTriggers({ outcomes, signals, matchLogs, registry, now }), ...(opts.drafts ?? [])];
  const clinicIds = new Set(registry.map((c) => c.id));
  const live = rules.filter((r) => r.status === "proposed" || r.status === "active");
  let next = Math.max(0, ...[...rules.map((r) => r.id), ...history.map((h) => h.value.id)].map((id) => Number(/^rule_(\d+)$/.exec(id)?.[1] ?? 0))) + 1;

  const result: ProposalResult = { proposed: [], discarded: [], suspended: [] };
  for (const draft of drafts) {
    const check = validateRuleDraft(draft, { clinicIds });
    if (!check.ok) {
      result.discarded.push({ draft, errors: check.errors });
      continue;
    }
    const candidate = { when: check.when, then: check.then };
    if ([...live, ...result.proposed].some((r) => sameRule(r, candidate))) continue;
    const rule: RoutingRule = {
      id: `rule_${String(next++).padStart(3, "0")}`,
      version: 1,
      status: "proposed",
      ...candidate,
      reason: draft.reason,
      evidence: draft.evidence,
      source: "auto_proposal",
      proposedBy: opts.proposedBy ?? PROPOSER_ID,
      createdAt: clock.nowIso(),
      ...(draft.expiresAt ? { expiresAt: draft.expiresAt } : {}),
      appliedCount: 0,
    };
    await platformStore.putRule(rule);
    result.proposed.push(rule);

    if (draft.urgent && "clinicIds" in check.then) {
      for (const id of check.then.clinicIds) {
        const clinic = registry.find((c) => c.id === id);
        if (clinic && clinic.verificationStatus !== "suspended") {
          await platformStore.putClinic({ ...clinic, verificationStatus: "suspended" });
          result.suspended.push(id);
        }
      }
    }
  }
  return result;
}
