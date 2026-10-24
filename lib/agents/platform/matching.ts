import type { ClinicShortlistV1, OffersV1, ProcedureRequestV1 } from "../../a2a/schemas";
import { issueReferralToken } from "../../a2a/auth";
import { clock } from "../../clock";
import type { ClinicRegistryEntry, Locale, MatchLog, Outcome, PriceRecord, RoutingRule } from "../../domain";
import { MIN_ANON_SET } from "../../store/seed-schemas";
import { checkEligibility, NOT_ELIGIBLE } from "./eligibility";
import { SAMPLE_WINDOW_DAYS, referenceFor, type PriceReference } from "./fairness";
import { buildReasons, type FactorKey } from "./matching-copy";
import { applyRules, countApplied, type RuleEffect } from "./rules";
import { clamp, mean, normalizedTotalKrw, regionGroupOf, round, withinDays, type RegionGroup } from "./stats";
import { platformStore, type PlatformSignal } from "./store";

// Clinic matching, 07 2절 (platform.match_clinics). Deterministic: no LLM, same inputs give the same scores and
// order, ties broken by clinicId. Money paid by clinics never enters (this file imports no settlement module).
// The platform never reads the clinic store: menus and offers come from the clinic.offers cache, language modes
// from the registry.

export const WEIGHTS: Record<FactorKey, number> = { fit: 0.35, price: 0.25, outcome: 0.25, reliability: 0.15 };
const FACTOR_ORDER: FactorKey[] = ["fit", "price", "outcome", "reliability"];
export const MAX_CANDIDATES = 3;
export const RELIABILITY_WINDOW_DAYS = 90;
const BUDGET_TOLERANCE = 1.1;
const BUDGET_PENALTY = 0.1;
const UNDERDOSED_PRICE_CAP = 0.3;
const PRIOR_N = 5;
const PRIOR_SATISFACTION = 4.0;
const MODE_FIT = { staff: 1, interpreter: 0.6, app_translation: 0 } as const;

export type OfferItem = OffersV1["items"][number];

export type HardFilterResult = { pass: true; items: OfferItem[] } | { pass: false; reason: "not_verified" | "no_procedure" | "language" };

/** 07 2절 하드 필터 1~3. Clinics without an offer cache are out (filter 2 reads the cache). */
export function hardFilter(clinic: ClinicRegistryEntry, offers: OffersV1 | undefined, request: ProcedureRequestV1): HardFilterResult {
  if (clinic.verificationStatus !== "verified" || !clinic.foreignPatientFacilityRegistered) return { pass: false, reason: "not_verified" };
  const items = (offers?.items ?? []).filter((item) => item.procedureId === request.procedureId);
  if (items.length === 0) return { pass: false, reason: "no_procedure" };
  if (!request.languages.includes("ko") && !bestLanguage(clinic, request)) return { pass: false, reason: "language" };
  return { pass: true, items };
}

/** The requested language this clinic serves best, staff before interpreter. App translation does not count. */
function bestLanguage(clinic: ClinicRegistryEntry, request: ProcedureRequestV1): ClinicRegistryEntry["languages"][number] | undefined {
  return clinic.languages
    .filter((l) => request.languages.includes(l.locale) && l.mode !== "app_translation")
    .sort((a, b) => MODE_FIT[b.mode] - MODE_FIT[a.mode] || request.languages.indexOf(a.locale) - request.languages.indexOf(b.locale))[0];
}

const isProofOnly = (item: OfferItem) => item.event?.zkClauses !== undefined;

/**
 * The menu or offer closest to the requested amount. Ties: an item anyone can get before a proof only event,
 * then the larger amount (07 1절 견적 규칙 2), then the lower price.
 */
export function nearestItem(items: readonly OfferItem[], amount: number): OfferItem {
  return [...items].sort(
    (a, b) =>
      Math.abs(a.amount.value - amount) - Math.abs(b.amount.value - amount) ||
      Number(isProofOnly(a)) - Number(isProofOnly(b)) ||
      b.amount.value - a.amount.value ||
      normalizedTotalKrw(a.priceKrw, a.vatIncluded) - normalizedTotalKrw(b.priceKrw, b.vatIncluded),
  )[0];
}

export interface ScoredCandidate {
  clinic: ClinicRegistryEntry;
  item: OfferItem;
  factors: Record<FactorKey, number>;
  details: {
    language?: ClinicRegistryEntry["languages"][number];
    unitKrw: number;
    totalKrw: number;
    priceBand: "low" | "mid" | "high" | "insufficient";
    outcomes: { n: number; avgSatisfaction: number };
    gaps: { n: number; avgGap: number };
    timeoutRatio: number;
  };
  budgetExceeded: boolean;
  /** 0..1, rounded to 4 decimals. Rules may change it afterwards. */
  score: number;
}

export interface ClinicHistory {
  /** All outcomes of the clinic (07 결과 요소). */
  outcomes: readonly Outcome[];
  /** response_timeout signals of the clinic. */
  timeouts: readonly PlatformSignal[];
  /** How many times the platform referred the clinic in the reliability window (the timeout denominator). */
  referrals: number;
}

/** 07 2절 점수표 for one clinic that passed the hard filters. Pure. */
export function scoreClinic(input: {
  clinic: ClinicRegistryEntry;
  items: readonly OfferItem[];
  request: ProcedureRequestV1;
  reference: PriceReference;
  history: ClinicHistory;
  now: Date;
}): ScoredCandidate {
  const { clinic, request, reference, history, now } = input;
  const language = bestLanguage(clinic, request) ?? clinic.languages.find((l) => request.languages.includes(l.locale));
  const fit = language ? MODE_FIT[language.mode] : 0;

  const item = nearestItem(input.items, request.amount.value);
  const totalKrw = normalizedTotalKrw(item.priceKrw, item.vatIncluded);
  const unitKrw = Math.round(totalKrw / item.amount.value);
  let price: number;
  let priceBand: ScoredCandidate["details"]["priceBand"];
  if (reference.n < 5) {
    price = 0.5;
    priceBand = "insufficient";
  } else {
    const spread = reference.p75 - reference.p25;
    price = spread > 0 ? clamp((reference.p75 - unitKrw) / spread) : unitKrw <= reference.p25 ? 1 : 0;
    priceBand = unitKrw < reference.p25 ? "low" : unitKrw <= reference.p75 ? "mid" : "high";
  }
  const typicalMin = reference.typicalAmount?.min;
  if (typicalMin !== undefined && input.items.every((i) => i.amount.value < typicalMin)) price = Math.min(price, UNDERDOSED_PRICE_CAP);

  const sats = history.outcomes.map((o) => o.satisfaction);
  const bayes = (PRIOR_N * PRIOR_SATISFACTION + sats.reduce((s, v) => s + v, 0)) / (PRIOR_N + sats.length);
  const outcome = clamp((bayes - 1) / 4);

  const gaps = history.outcomes
    .filter((o) => o.quoteGapRatio !== undefined && withinDays(o.submittedAt, now, RELIABILITY_WINDOW_DAYS))
    .map((o) => o.quoteGapRatio as number);
  const avgGap = Math.max(0, mean(gaps));
  const timeouts = history.timeouts.filter((s) => withinDays(s.at, now, RELIABILITY_WINDOW_DAYS)).length;
  const timeoutRatio = timeouts === 0 ? 0 : timeouts / Math.max(history.referrals, timeouts);
  const reliability = (1 - Math.min(1, avgGap * 2)) * (1 - timeoutRatio);

  const factors = { fit, price, outcome, reliability };
  const budgetExceeded = request.budgetKrw !== undefined && totalKrw > request.budgetKrw.max * BUDGET_TOLERANCE;
  const raw = FACTOR_ORDER.reduce((sum, key) => sum + WEIGHTS[key] * factors[key], 0) - (budgetExceeded ? BUDGET_PENALTY : 0);

  return {
    clinic,
    item,
    factors,
    details: {
      ...(language ? { language } : {}),
      unitKrw,
      totalKrw,
      priceBand,
      outcomes: { n: sats.length, avgSatisfaction: round(mean(sats), 1) },
      gaps: { n: gaps.length, avgGap },
      timeoutRatio,
    },
    budgetExceeded,
    score: round(clamp(raw), 4),
  };
}

/** Score descending, then clinicId (07 2절 3, 결정론). */
export const byScore = (a: { score: number; clinic: { id: string } }, b: { score: number; clinic: { id: string } }) =>
  b.score - a.score || a.clinic.id.localeCompare(b.clinic.id);

export interface MatchInputs {
  request: ProcedureRequestV1;
  registry: readonly ClinicRegistryEntry[];
  offers: readonly OffersV1[];
  priceRecords: readonly PriceRecord[];
  outcomes: readonly Outcome[];
  signals: readonly PlatformSignal[];
  /** Referrals per clinic in the last 90 days. */
  referrals: Readonly<Record<string, number>>;
  rules: readonly RoutingRule[];
  now: Date;
}

export interface Ranking {
  candidatesBeforeRules: ScoredCandidate[];
  ranked: (ScoredCandidate & { ruleEffects: RuleEffect[] })[];
  appliedRuleIds: string[];
}

/** Hard filters, scores, rules, top three. Pure. */
export function rankClinics(inputs: MatchInputs): Ranking {
  const { request, now } = inputs;
  const product = request.productPreference && request.productPreference !== "any" ? request.productPreference : undefined;
  const scored: ScoredCandidate[] = [];
  for (const clinic of inputs.registry) {
    const filter = hardFilter(clinic, inputs.offers.find((o) => o.clinicId === clinic.id), request);
    if (!filter.pass) continue;
    const { reference } = referenceFor(inputs.priceRecords, { procedureId: request.procedureId, area: clinic.area, product, now });
    scored.push(
      scoreClinic({
        clinic,
        items: filter.items,
        request,
        reference,
        history: {
          outcomes: inputs.outcomes.filter((o) => o.clinicId === clinic.id),
          timeouts: inputs.signals.filter((s) => s.clinicId === clinic.id && s.kind === "response_timeout"),
          referrals: inputs.referrals[clinic.id] ?? 0,
        },
        now,
      }),
    );
  }
  const candidatesBeforeRules = [...scored].sort(byScore);
  const applied = applyRules(candidatesBeforeRules, inputs.rules, request, now);
  const ranked = applied.candidates.map((c) => ({ ...c, score: round(c.score, 4) })).sort(byScore).slice(0, MAX_CANDIDATES);
  return { candidatesBeforeRules, ranked, appliedRuleIds: applied.appliedRuleIds };
}

/** Factors by contribution to the score, largest first; equal contributions keep the 07 table order. */
export function topFactors(candidate: Pick<ScoredCandidate, "factors">): FactorKey[] {
  return [...FACTOR_ORDER].sort(
    (a, b) => WEIGHTS[b] * candidate.factors[b] - WEIGHTS[a] * candidate.factors[a] || FACTOR_ORDER.indexOf(a) - FACTOR_ORDER.indexOf(b),
  );
}

/** The single region group of the requested areas, or Seoul when they span several or are absent. */
function requestRegion(request: ProcedureRequestV1): RegionGroup | "seoul" {
  const groups = new Set((request.areas ?? []).map(regionGroupOf));
  return groups.size === 1 ? [...groups][0] : "seoul";
}

// ---- adapter ----

export type MatchResult =
  | { state: "completed"; shortlist: ClinicShortlistV1; log: MatchLog }
  | { state: "rejected"; reason: typeof NOT_ELIGIBLE | "customer_agent_mismatch" }
  /** No clinic.offers cache at all: the platform cannot match yet (03 "플랫폼 장애"), not "no clinic fits". */
  | { state: "failed"; reason: "offer_cache_empty" };

const newMatchId = () => `mt_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

/**
 * platform.match_clinics. `callerAgentId` is the `sub` of the caller's agent token: a customer agent may only
 * ask for itself, because the referral tokens are issued to `request.customerAgentId`.
 */
export async function matchClinics(request: ProcedureRequestV1, callerAgentId: string): Promise<MatchResult> {
  if (request.customerAgentId !== callerAgentId) return { state: "rejected", reason: "customer_agent_mismatch" };
  const eligibility = checkEligibility(request.visitorProfile);
  if (!eligibility.eligible) return { state: "rejected", reason: eligibility.reason };

  const now = clock.now();
  const [registry, caches, priceRecords, outcomes, signals, rules, logs, visits, reviews] = await Promise.all([
    platformStore.registry(),
    platformStore.offerCaches(),
    platformStore.priceRecords(),
    platformStore.outcomes(),
    platformStore.signals(),
    platformStore.rules(),
    platformStore.matchLogs(),
    platformStore.verifiedVisits(),
    platformStore.reviewStats(),
  ]);
  if (caches.length === 0) return { state: "failed", reason: "offer_cache_empty" };
  const referrals: Record<string, number> = {};
  for (const log of logs) {
    if (!withinDays(log.at, now, RELIABILITY_WINDOW_DAYS)) continue;
    for (const c of log.result.candidates) referrals[c.clinicId] = (referrals[c.clinicId] ?? 0) + 1;
  }

  const ranking = rankClinics({
    request,
    registry,
    offers: caches.map((c) => c.offers),
    priceRecords,
    outcomes,
    signals,
    referrals,
    rules,
    now,
  });

  const matchId = newMatchId();
  const locale: Locale = request.languages[0];
  const product = request.productPreference && request.productPreference !== "any" ? request.productPreference : undefined;
  const { reference } = referenceFor(priceRecords, { procedureId: request.procedureId, region: requestRegion(request), product, now });

  const candidates: ClinicShortlistV1["candidates"] = [];
  for (const c of ranking.ranked) {
    const visit = visits.find((v) => v.clinicId === c.clinic.id && v.procedureId === request.procedureId);
    const review = reviews.find((r) => r.clinicId === c.clinic.id && r.procedureId === request.procedureId);
    const near = (request.areas ?? []).includes(c.clinic.area) ? c.clinic.area : undefined;
    candidates.push({
      clinicId: c.clinic.id,
      agentCardUrl: c.clinic.agentCardUrl,
      score: c.score,
      reasons: buildReasons(
        {
          topFactors: topFactors(c),
          ...(c.details.language ? { language: c.details.language } : {}),
          priceBand: c.details.priceBand,
          outcomes: c.details.outcomes,
          gaps: c.details.gaps,
          ruleAdjusted: c.ruleEffects.some((e) => e !== "demote"),
          budgetExceeded: c.budgetExceeded,
          ...(near ? { nearStayArea: near } : {}),
        },
        locale,
      ),
      referralToken: await issueReferralToken({
        clinicId: c.clinic.id,
        customerAgentId: request.customerAgentId,
        requestId: request.requestId,
        matchId,
      }),
      ...(visit ? { verifiedVisits: visit.count } : {}),
      // Display only, never scored; hidden below the anonymity set (07 검증 방문과 후기 집계, 08).
      ...(review && review.n >= MIN_ANON_SET ? { reviewStats: { n: review.n, avgRating: review.avgRating } } : {}),
    });
  }

  const shortlist: ClinicShortlistV1 = {
    schema: "pibu/clinic-shortlist@1",
    requestId: request.requestId,
    matchId,
    appliedRuleIds: ranking.appliedRuleIds,
    priceReference: {
      procedureId: request.procedureId,
      unit: request.amount.unit,
      region: reference.region,
      p25UnitKrw: reference.p25,
      p50UnitKrw: reference.p50,
      p75UnitKrw: reference.p75,
      sampleSize: reference.n,
      windowDays: SAMPLE_WINDOW_DAYS,
    },
    candidates,
  };
  const log: MatchLog = {
    id: matchId,
    requestId: request.requestId,
    customerAgentId: request.customerAgentId,
    request,
    candidatesBeforeRules: ranking.candidatesBeforeRules.map((c) => ({ clinicId: c.clinic.id, score: c.score })),
    appliedRuleIds: ranking.appliedRuleIds,
    result: shortlist,
    at: clock.nowIso(),
  };
  await platformStore.putMatchLog(log);
  await countApplied(ranking.appliedRuleIds);
  return { state: "completed", shortlist, log };
}
