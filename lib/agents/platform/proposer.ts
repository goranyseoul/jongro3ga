// Rule proposer (07-platform-intelligence.md section 4). Step 1 is deterministic: triggers over the last
// 30 days of outcomes and signals per clinic x nationality produce candidates with template wording.
// Step 2 asks Claude (reasoning tier, forced propose_rules tool) to write the Korean reason and evidence
// summary and to add at most 2 extra patterns. Everything is screened server side; when Claude fails the
// candidates go out with the template wording, so the demo never depends on the LLM.
import { clock } from "../../clock";
import type { ClinicRegistryEntry, Outcome, RuleAction, RuleCondition, Signal } from "../../domain/platform";
import { runClaude, type RunOptions, type ToolCallResult } from "../../llm/index";
import type { Store } from "../../store/types";
import {
  PROPOSE_RULES_TOOL,
  ProposeRulesInputSchema,
  ruleSignature,
  screenDraft,
  type DropReason,
  type RuleDraft,
  type ScreenContext,
} from "./proposer-guardrails";
import { expireRules, listRules, nextRuleId, saveProposedRule, type OpsRule } from "./proposer-rules";
import {
  AREA_GROUPS,
  PLATFORM_COLLECTIONS,
  SEGMENT_WINDOW_DAYS,
  aggregateAreaGroups,
  aggregateSegments,
  aggregateSideEffects,
  clinicDisplayName,
  loadWindow,
  toKstIso,
  type AreaGroup,
  type AreaGroupStats,
  type SegmentStats,
  type SideEffectStats,
  type WindowInput,
} from "./signals";

/** Thresholds of the deterministic triggers, exactly as the table in 07 section 4. */
export const TRIGGERS = {
  quoteGap: { minN: 5, meanAbove: 0.2 },
  lowSatisfaction: { minN: 5, ratioAbove: 0.4, delta: 0.2 },
  responseTimeout: { minN: 5, ratioAbove: 0.5, delta: 0.15 },
  areaPreference: { minN: 8, minDiff: 0.8, delta: 0.1 },
  sideEffect: { minReports: 2 },
} as const;

/** Claude may add at most this many rules the triggers did not produce. */
export const MAX_EXTRA_PROPOSALS = 2;
export const PROPOSER_FIXTURE_KEY = "proposer";

export type TriggerKind = "quote_gap" | "low_satisfaction" | "response_timeout" | "area_preference" | "side_effect";

export interface RuleCandidate {
  /** Stable id of the candidate, e.g. "quote_gap:cln_ara:JP". Claude echoes it back. */
  key: string;
  trigger: TriggerKind;
  urgent: boolean;
  when: RuleCondition;
  then: RuleAction;
  evidence: { outcomeIds: string[]; signalIds: string[] };
  /** The numbers behind the trigger (n, mean, ratio). */
  stats: Record<string, number>;
  templateReason: string;
  templateSummary: string;
}

const NATIONALITY_KO: Record<string, string> = {
  JP: "일본",
  CN: "중국",
  US: "미국",
  KR: "한국",
  TW: "대만",
  HK: "홍콩",
  TH: "태국",
  VN: "베트남",
  SG: "싱가포르",
  GB: "영국",
  AU: "호주",
};
const AREA_GROUP_KO: Record<AreaGroup, string> = { gangnam_sinsa: "강남·신사·압구정", myeongdong: "명동", hongdae: "홍대", other: "기타 지역" };

export const nationalityKo = (code: string) => NATIONALITY_KO[code] ?? code;
const pct = (ratio: number) => Math.round(ratio * 100);
const one = (value: number) => (Math.round(value * 10) / 10).toFixed(1);

// ---- step 1: deterministic triggers ----

export function evaluateTriggers(input: WindowInput): RuleCandidate[] {
  const segments = aggregateSegments(input);
  const name = (clinicId: string) => clinicDisplayName(input.registry.find((clinic) => clinic.id === clinicId), clinicId);
  const out: RuleCandidate[] = [
    ...quoteGapCandidates(segments, name),
    ...lowSatisfactionCandidates(segments, name),
    ...timeoutCandidates(segments, name),
    ...areaPreferenceCandidates(aggregateAreaGroups(input)),
    ...sideEffectCandidates(aggregateSideEffects(input), name),
  ];
  return out;
}

type NameOf = (clinicId: string) => string;

function quoteGapCandidates(segments: SegmentStats[], name: NameOf): RuleCandidate[] {
  const { minN, meanAbove } = TRIGGERS.quoteGap;
  return segments
    .filter((s) => s.gapN >= minN && s.meanGap !== null && s.meanGap > meanAbove)
    .map((s) => {
      const nat = nationalityKo(s.nationality);
      const gap = pct(s.meanGap as number);
      return {
        key: `quote_gap:${s.clinicId}:${s.nationality}`,
        trigger: "quote_gap",
        urgent: false,
        when: { nationalities: [s.nationality] },
        then: { kind: "exclude_clinic", clinicIds: [s.clinicId] },
        evidence: { outcomeIds: s.gapOutcomeIds, signalIds: [] },
        stats: { n: s.gapN, meanGap: s.meanGap as number },
        templateReason: `${nat} 고객이 ${name(s.clinicId)}에서 견적보다 평균 ${gap}% 더 결제했어요. 같은 일이 이어지는 동안 ${nat} 고객 매칭에서 제외해요.`,
        templateSummary: `최근 ${SEGMENT_WINDOW_DAYS}일 견적 대비 실결제 평균 +${gap}% (n=${s.gapN})`,
      };
    });
}

function lowSatisfactionCandidates(segments: SegmentStats[], name: NameOf): RuleCandidate[] {
  const { minN, ratioAbove, delta } = TRIGGERS.lowSatisfaction;
  return segments
    .filter((s) => s.n >= minN && s.lowSatisfactionRatio !== null && s.lowSatisfactionRatio > ratioAbove)
    .map((s) => {
      const nat = nationalityKo(s.nationality);
      return {
        key: `low_satisfaction:${s.clinicId}:${s.nationality}`,
        trigger: "low_satisfaction",
        urgent: false,
        when: { nationalities: [s.nationality] },
        then: { kind: "demote_clinic", clinicIds: [s.clinicId], delta },
        evidence: { outcomeIds: s.lowSatisfactionOutcomeIds, signalIds: [] },
        stats: { n: s.n, lowRatio: s.lowSatisfactionRatio as number },
        templateReason: `${nat} 고객의 ${name(s.clinicId)} 만족도가 낮아요. ${nat} 고객 매칭에서 순위를 낮춰요.`,
        templateSummary: `최근 ${SEGMENT_WINDOW_DAYS}일 만족도 2점 이하 비율 ${pct(s.lowSatisfactionRatio as number)}% (n=${s.n})`,
      };
    });
}

function timeoutCandidates(segments: SegmentStats[], name: NameOf): RuleCandidate[] {
  const { minN, ratioAbove, delta } = TRIGGERS.responseTimeout;
  return segments
    .filter((s) => s.quoteRequests >= minN && s.timeoutRatio !== null && s.timeoutRatio > ratioAbove)
    .map((s) => {
      const nat = nationalityKo(s.nationality);
      return {
        key: `response_timeout:${s.clinicId}:${s.nationality}`,
        trigger: "response_timeout",
        urgent: false,
        when: { nationalities: [s.nationality] },
        then: { kind: "demote_clinic", clinicIds: [s.clinicId], delta },
        evidence: { outcomeIds: [], signalIds: s.timeoutSignalIds },
        stats: { n: s.quoteRequests, timeoutRatio: s.timeoutRatio as number },
        templateReason: `${name(s.clinicId)}이 ${nat} 고객 견적 요청에 제때 답하지 못하는 일이 많아요. ${nat} 고객 매칭에서 순위를 낮춰요.`,
        templateSummary: `최근 ${SEGMENT_WINDOW_DAYS}일 견적 요청 응답 시간 초과 비율 ${pct(s.timeoutRatio as number)}% (n=${s.quoteRequests})`,
      };
    });
}

function areaPreferenceCandidates(groups: AreaGroupStats[]): RuleCandidate[] {
  const { minN, minDiff, delta } = TRIGGERS.areaPreference;
  const byNationality = new Map<string, AreaGroupStats[]>();
  for (const group of groups) {
    if (group.n < minN) continue;
    byNationality.set(group.nationality, [...(byNationality.get(group.nationality) ?? []), group]);
  }
  const out: RuleCandidate[] = [];
  for (const [nationality, list] of byNationality) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => b.meanSatisfaction - a.meanSatisfaction || a.group.localeCompare(b.group));
    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    if (best.meanSatisfaction - worst.meanSatisfaction < minDiff) continue;
    const nat = nationalityKo(nationality);
    out.push({
      key: `area_preference:${best.group}:${nationality}`,
      trigger: "area_preference",
      urgent: false,
      when: { nationalities: [nationality] },
      then: { kind: "prefer_area", areas: [...AREA_GROUPS[best.group]], delta },
      evidence: { outcomeIds: [...best.outcomeIds, ...worst.outcomeIds], signalIds: [] },
      stats: { n: best.n + worst.n, bestMean: best.meanSatisfaction, worstMean: worst.meanSatisfaction },
      templateReason: `${nat} 고객은 ${AREA_GROUP_KO[best.group]} 병원에서 만족도가 더 높았어요. ${nat} 고객 매칭에서 이 지역 점수를 조금 올려요.`,
      templateSummary: `최근 ${SEGMENT_WINDOW_DAYS}일 ${nat} 고객 만족도 ${AREA_GROUP_KO[best.group]} ${one(best.meanSatisfaction)}점 (n=${best.n}), ${AREA_GROUP_KO[worst.group]} ${one(worst.meanSatisfaction)}점 (n=${worst.n})`,
    });
  }
  return out;
}

function sideEffectCandidates(stats: SideEffectStats[], name: NameOf): RuleCandidate[] {
  return stats
    .filter((s) => s.count >= TRIGGERS.sideEffect.minReports)
    .map((s) => ({
      key: `side_effect:${s.clinicId}`,
      trigger: "side_effect",
      urgent: true,
      when: {},
      then: { kind: "exclude_clinic", clinicIds: [s.clinicId] },
      evidence: { outcomeIds: s.outcomeIds, signalIds: s.signalIds },
      stats: { n: s.count },
      templateReason: `긴급: ${name(s.clinicId)}에서 부작용 보고가 ${s.count}건 들어왔어요. 운영자 확인 전까지 병원 상태를 정지로 바꾸고 모든 매칭에서 제외해요.`,
      templateSummary: `최근 ${SEGMENT_WINDOW_DAYS}일 부작용 보고 ${s.count}건`,
    }));
}

// ---- step 2: Claude ----

const SYSTEM_PROMPT = [
  "You write routing rule proposals for the operators of PibooK, a platform that connects foreign visitors with Korean dermatology clinics.",
  "You receive deterministic rule candidates and an aggregate table (clinic x nationality, last 30 days, no personal data).",
  "Call propose_rules once. For every candidate return a draft with the same candidateKey, when and then, a Korean `reason` (one or two plain sentences an operator can act on) and a Korean `evidence.summary` that repeats the candidate's numbers exactly (same percentages and the same n=).",
  `You may add at most ${MAX_EXTRA_PROPOSALS} extra drafts without candidateKey for patterns the candidates miss; each must cite existing outcomeIds.`,
  "Guardrails: never use health information (safety, skin, pregnancy, allergies) in a condition. Never propose different prices by nationality. Use a nationality condition only for language or area preference, or to exclude or demote a clinic where customers of that nationality were actually harmed.",
  "No medical diagnosis or treatment advice, and no wording that ranks clinics against each other for customers.",
].join("\n");

export interface ProposerDeps {
  llm?: (options: RunOptions) => Promise<ToolCallResult>;
  now?: Date;
}

export interface DroppedDraft {
  source: "claude" | "trigger";
  candidateKey?: string;
  reason: DropReason | "not_a_candidate_match" | "numbers_changed" | "too_many_extras" | "duplicate";
  detail: string;
}

export interface ProposerRun {
  ranAt: string;
  windowDays: number;
  /** "claude" when the propose_rules call returned usable output, "template" otherwise. */
  mode: "claude" | "template";
  claudeError?: string;
  candidates: RuleCandidate[];
  proposed: OpsRule[];
  skipped: { key: string; reason: "already_proposed" | "already_active" | "rejected_before"; ruleId: string }[];
  dropped: DroppedDraft[];
  suspendedClinicIds: string[];
  expiredRuleIds: string[];
  segments: SegmentStats[];
}

function claudeInput(input: WindowInput, candidates: RuleCandidate[], segments: SegmentStats[], existing: OpsRule[]): string {
  return JSON.stringify(
    {
      now: toKstIso(input.now),
      windowDays: SEGMENT_WINDOW_DAYS,
      candidates: candidates.map((c) => ({
        candidateKey: c.key,
        trigger: c.trigger,
        urgent: c.urgent,
        when: c.when,
        then: c.then,
        stats: c.stats,
        evidence: c.evidence,
        templateReason: c.templateReason,
        templateSummary: c.templateSummary,
      })),
      segments: segments.map((s) => ({
        clinicId: s.clinicId,
        nationality: s.nationality,
        n: s.n,
        meanGap: s.meanGap,
        meanSatisfaction: s.meanSatisfaction,
        lowSatisfactionRatio: s.lowSatisfactionRatio,
        timeoutRatio: s.timeoutRatio,
        outcomeIds: s.outcomeIds,
      })),
      clinics: input.registry.map((clinic) => ({ id: clinic.id, name: clinicDisplayName(clinic, clinic.id), area: clinic.area, operationMode: clinic.operationMode })),
      activeRules: existing.filter((rule) => rule.status === "active").map((rule) => ({ id: rule.id, when: rule.when, then: rule.then })),
    },
    null,
    2,
  );
}

/** Every number in the template summary must appear in Claude's summary, so the model cannot change figures. */
function keepsNumbers(template: string, written: string): boolean {
  const numbers = template.match(/\d+(?:\.\d+)?/g) ?? [];
  return numbers.every((n) => written.includes(n));
}

// ---- run ----

export async function runProposer(store: Store, deps: ProposerDeps = {}): Promise<ProposerRun> {
  const now = deps.now ?? clock.now();
  const llm = deps.llm ?? runClaude;
  const expiredRuleIds = await expireRules(store, now);
  const input = await loadWindow(store, now);
  const segments = aggregateSegments(input);
  const candidates = evaluateTriggers(input);
  const existing = await listRules(store);

  const allOutcomes = await store.list<Outcome>("platform", PLATFORM_COLLECTIONS.outcomes);
  const allSignals = await store.list<Signal>("platform", PLATFORM_COLLECTIONS.signals);
  const ctx: ScreenContext = {
    clinicIds: new Set(input.registry.map((clinic) => clinic.id)),
    outcomes: new Map(allOutcomes.map((outcome) => [outcome.outcomeId, outcome])),
    signals: new Map(allSignals.map((signal) => [signal.id, signal])),
  };

  const dropped: DroppedDraft[] = [];
  const skipped: ProposerRun["skipped"] = [];

  // Duplicates of live or already reviewed rules are not proposed again.
  const evidenceKey = (ids: { outcomeIds: string[]; signalIds: string[] }) => JSON.stringify([[...ids.outcomeIds].sort(), [...ids.signalIds].sort()]);
  const isDuplicate = (when: RuleCondition, then: RuleAction, evidence: { outcomeIds: string[]; signalIds: string[] }, key: string) => {
    const signature = ruleSignature(when, then);
    for (const rule of existing) {
      if (ruleSignature(rule.when, rule.then) !== signature) continue;
      if (rule.status === "proposed") return skipped.push({ key, reason: "already_proposed", ruleId: rule.id }) > 0;
      if (rule.status === "active") return skipped.push({ key, reason: "already_active", ruleId: rule.id }) > 0;
      if (rule.status === "rejected" && evidenceKey(rule.evidence) === evidenceKey(evidence)) {
        return skipped.push({ key, reason: "rejected_before", ruleId: rule.id }) > 0;
      }
    }
    return false;
  };

  const fresh = candidates.filter((c) => !isDuplicate(c.when, c.then, c.evidence, c.key));
  // Candidates whose clinic left the registry are dropped by the same screen Claude output goes through.
  const screened = fresh.filter((c) => {
    const result = screenDraft({ candidateKey: c.key, when: c.when, then: c.then, reason: c.templateReason, evidence: { ...c.evidence, summary: c.templateSummary } }, ctx);
    if (!result.ok) dropped.push({ source: "trigger", candidateKey: c.key, reason: result.reason, detail: result.detail });
    return result.ok;
  });

  let mode: ProposerRun["mode"] = "template";
  let claudeError: string | undefined;
  const written = new Map<string, RuleDraft>();
  const extras: RuleDraft[] = [];

  if (screened.length > 0 || input.outcomes.length > 0) {
    try {
      const result = await llm({
        tier: "reasoning",
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: claudeInput(input, screened, segments, existing) }],
        tools: [PROPOSE_RULES_TOOL],
        toolChoice: PROPOSE_RULES_TOOL.name,
        fixtureKey: PROPOSER_FIXTURE_KEY,
        maxTokens: 4000,
      });
      const call = result.toolCalls.find((tool) => tool.name === PROPOSE_RULES_TOOL.name);
      const parsed = ProposeRulesInputSchema.safeParse(call?.input);
      if (!parsed.success) throw new Error("propose_rules was not called with a rules array");
      mode = "claude";
      const byKey = new Map(screened.map((c) => [c.key, c]));
      for (const raw of parsed.data.rules) {
        const check = screenDraft(raw, ctx);
        const key = (raw as { candidateKey?: unknown } | null)?.candidateKey;
        if (!check.ok) {
          dropped.push({ source: "claude", candidateKey: typeof key === "string" ? key : undefined, reason: check.reason, detail: check.detail });
          continue;
        }
        const draft = check.draft;
        if (draft.candidateKey && byKey.has(draft.candidateKey)) {
          const candidate = byKey.get(draft.candidateKey) as RuleCandidate;
          if (ruleSignature(draft.when, draft.then) !== ruleSignature(candidate.when, candidate.then)) {
            dropped.push({ source: "claude", candidateKey: draft.candidateKey, reason: "not_a_candidate_match", detail: "Claude changed the condition or action; the trigger's rule is kept" });
            continue;
          }
          if (!keepsNumbers(candidate.templateSummary, draft.evidence.summary)) {
            dropped.push({ source: "claude", candidateKey: draft.candidateKey, reason: "numbers_changed", detail: "summary does not repeat the trigger's numbers; template summary kept" });
            written.set(draft.candidateKey, { ...draft, evidence: { ...draft.evidence, summary: candidate.templateSummary } });
            continue;
          }
          written.set(draft.candidateKey, draft);
          continue;
        }
        // An extra pattern: needs its own outcome evidence and must not repeat a candidate or a live rule.
        if (draft.evidence.outcomeIds.length === 0) {
          dropped.push({ source: "claude", reason: "missing_evidence", detail: "extra proposals must cite outcomeIds" });
          continue;
        }
        const signature = ruleSignature(draft.when, draft.then);
        if (screened.some((c) => ruleSignature(c.when, c.then) === signature) || extras.some((e) => ruleSignature(e.when, e.then) === signature)) {
          dropped.push({ source: "claude", reason: "duplicate", detail: "same rule as a candidate" });
          continue;
        }
        if (isDuplicate(draft.when, draft.then, draft.evidence, `claude_extra:${signature}`)) continue;
        if (extras.length >= MAX_EXTRA_PROPOSALS) {
          dropped.push({ source: "claude", reason: "too_many_extras", detail: `only ${MAX_EXTRA_PROPOSALS} extra proposals are kept` });
          continue;
        }
        extras.push(draft);
      }
    } catch (error) {
      mode = "template";
      claudeError = error instanceof Error ? error.message : String(error);
    }
  }

  const model = process.env.CLAUDE_MODEL_REASONING || "claude-opus-5-5";
  const proposedBy = mode === "claude" ? model : "template";
  const createdAt = toKstIso(now);
  const proposed: OpsRule[] = [];
  const suspendedClinicIds: string[] = [];

  for (const candidate of screened) {
    const draft = written.get(candidate.key);
    const rule: OpsRule = {
      id: await nextRuleId(store),
      version: 1,
      status: "proposed",
      when: candidate.when,
      then: candidate.then,
      reason: draft?.reason ?? candidate.templateReason,
      evidence: { ...candidate.evidence, summary: draft?.evidence.summary ?? candidate.templateSummary },
      source: "auto_proposal",
      proposedBy: draft ? model : "template",
      createdAt,
      appliedCount: 0,
      urgent: candidate.urgent || undefined,
      trigger: candidate.trigger,
      candidateKey: candidate.key,
    };
    if (candidate.urgent) rule.suspension = await suspendForEmergency(store, candidate, createdAt, suspendedClinicIds);
    proposed.push(await saveProposedRule(store, rule, rule.proposedBy as string));
  }
  for (const draft of extras) {
    const rule: OpsRule = {
      id: await nextRuleId(store),
      version: 1,
      status: "proposed",
      when: draft.when,
      then: draft.then,
      reason: draft.reason,
      evidence: draft.evidence,
      source: "auto_proposal",
      proposedBy,
      createdAt,
      appliedCount: 0,
      trigger: "claude_extra",
    };
    proposed.push(await saveProposedRule(store, rule, proposedBy));
  }

  return {
    ranAt: createdAt,
    windowDays: SEGMENT_WINDOW_DAYS,
    mode,
    ...(claudeError ? { claudeError } : {}),
    candidates,
    proposed,
    skipped,
    dropped,
    suspendedClinicIds,
    expiredRuleIds,
    segments,
  };
}

/**
 * The one change applied without approval (guardrail 4): an urgent side effect trigger suspends the
 * clinic in the registry, which takes it out of matching through the hard filter. The proposed rule is
 * the operator's confirmation request; rejecting it restores the previous status.
 */
async function suspendForEmergency(store: Store, candidate: RuleCandidate, at: string, suspended: string[]): Promise<OpsRule["suspension"]> {
  const clinicIds = "clinicIds" in candidate.then ? candidate.then.clinicIds : [];
  const previous: Record<string, ClinicRegistryEntry["verificationStatus"]> = {};
  for (const clinicId of clinicIds) {
    const entry = await store.get<ClinicRegistryEntry>("platform", PLATFORM_COLLECTIONS.registry, clinicId);
    if (!entry || entry.verificationStatus === "suspended") continue;
    previous[clinicId] = entry.verificationStatus;
    await store.put("platform", PLATFORM_COLLECTIONS.registry, { ...entry, verificationStatus: "suspended" });
    suspended.push(clinicId);
  }
  return { clinicIds: Object.keys(previous), previous, at };
}
