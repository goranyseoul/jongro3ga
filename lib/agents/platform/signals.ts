// Outcome and signal aggregation for the improvement loop (07-platform-intelligence.md section 4) and
// the ops console views (/ops/signals, /ops/prices, /ops/clinics freshness). Pure functions over plain
// data plus thin store adapters. Only the `platform` namespace and the shared A2A log are read here.
//
// Relative imports on purpose: vitest in this repo has no "@/" alias.
import { listA2ALog } from "../../a2a/log";
import { clock } from "../../clock";
import type { Area, IsoDate, Nationality } from "../../domain/common";
import type { ClinicRegistryEntry, Outcome, PriceRecord, Signal } from "../../domain/platform";
import type { A2ALogEntry } from "../../domain/shared";
import type { Store } from "../../store/types";

/**
 * Collection names inside the `platform` namespace. The seed loader (track A2A core) and the platform
 * skills must write the same names; this is the single place the ops track reads them from.
 */
export const PLATFORM_COLLECTIONS = {
  registry: "clinic_registry",
  outcomes: "outcomes",
  signals: "signals",
  rules: "routing_rules",
  ruleHistory: "routing_rule_history",
  matchLogs: "match_logs",
  attributions: "attributions",
  priceRecords: "price_records",
} as const;

export const DAY_MS = 86_400_000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Trigger window of the proposer (07 section 4: "30일"). */
export const SEGMENT_WINDOW_DAYS = 30;
/** Price sample window of the verdict (07 section 1: "최근 120일"). */
export const PRICE_WINDOW_DAYS = 120;
/** A registry entry older than this gets a freshness warning (05-screens.md /ops/clinics). */
export const STALE_AFTER_DAYS = 30;
/** Satisfaction at or below this is a low_satisfaction outcome (07 section 3). */
export const LOW_SATISFACTION_MAX = 2;

export const AREA_GROUPS: Record<"gangnam_sinsa" | "myeongdong" | "hongdae" | "other", Area[]> = {
  gangnam_sinsa: ["gangnam", "sinsa", "apgujeong"],
  myeongdong: ["myeongdong"],
  hongdae: ["hongdae"],
  other: ["other"],
};
export type AreaGroup = keyof typeof AREA_GROUPS;

export function areaGroupOf(area: Area): AreaGroup {
  for (const [group, areas] of Object.entries(AREA_GROUPS) as [AreaGroup, Area[]][]) {
    if (areas.includes(area)) return group;
  }
  return "other";
}

/** ISO 8601 with the +09:00 offset used across the data model. */
export function toKstIso(date: Date): string {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  return `${kst.toISOString().slice(0, 19)}+09:00`;
}

export function kstDate(date: Date): IsoDate {
  return new Date(date.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** True when `at` lies in [now - days, now], both ends included. */
export function inWindow(at: string | undefined, now: Date, days: number): boolean {
  if (!at) return false;
  const t = Date.parse(at);
  if (Number.isNaN(t)) return false;
  return t <= now.getTime() && t >= now.getTime() - days * DAY_MS;
}

/** When an outcome happened: the customer's submission time, else when the platform received it. */
export function outcomeAt(outcome: Outcome): string {
  return outcome.submittedAt ?? outcome.receivedAt;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Linear interpolation between closest ranks (the p25/p50/p75/p90 rule of 07 section 1). */
export function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// ---- inputs ----

export interface WindowInput {
  now: Date;
  registry: ClinicRegistryEntry[];
  /** Outcomes inside the window. */
  outcomes: Outcome[];
  /** Signals inside the window. */
  signals: Signal[];
  /** clinic.quote calls inside the window, the denominator of the timeout ratio. */
  quoteCalls: A2ALogEntry[];
}

/** Reads everything the triggers need for the window ending at `now`. */
export async function loadWindow(store: Store, now: Date = clock.now(), days = SEGMENT_WINDOW_DAYS): Promise<WindowInput> {
  const [registry, outcomes, signals, log] = await Promise.all([
    store.list<ClinicRegistryEntry>("platform", PLATFORM_COLLECTIONS.registry),
    store.list<Outcome>("platform", PLATFORM_COLLECTIONS.outcomes),
    store.list<Signal>("platform", PLATFORM_COLLECTIONS.signals),
    listA2ALog(store, { skillId: "clinic.quote" }),
  ]);
  return {
    now,
    registry,
    outcomes: outcomes.filter((outcome) => inWindow(outcomeAt(outcome), now, days)),
    signals: signals.filter((signal) => inWindow(signal.at, now, days)),
    quoteCalls: log.filter((entry) => entry.method === "SendMessage" && entry.to.role === "clinic" && inWindow(entry.at, now, days)),
  };
}

/** Nationality of the customer behind a logged clinic.quote call, read from the request's data part. */
export function nationalityOfCall(entry: A2ALogEntry): Nationality | undefined {
  const parts = (entry.request as { params?: { message?: { parts?: unknown[] } } } | undefined)?.params?.message?.parts;
  if (!Array.isArray(parts)) return undefined;
  for (const part of parts) {
    const data = (part as { data?: { visitorProfile?: { nationality?: unknown } } } | null)?.data;
    const nationality = data?.visitorProfile?.nationality;
    if (typeof nationality === "string") return nationality;
  }
  return undefined;
}

// ---- clinic x nationality segments ----

export interface SegmentStats {
  clinicId: string;
  nationality: Nationality;
  /** Outcomes in the window. */
  n: number;
  outcomeIds: string[];
  /** Outcomes that carry a quoteGapRatio (linked to a judged quote). */
  gapN: number;
  meanGap: number | null;
  gapOutcomeIds: string[];
  meanSatisfaction: number | null;
  lowSatisfactionCount: number;
  lowSatisfactionRatio: number | null;
  lowSatisfactionOutcomeIds: string[];
  /** Quote requests sent to the clinic for this nationality (at least the number of timeouts and rejections). */
  quoteRequests: number;
  timeouts: number;
  timeoutRatio: number | null;
  timeoutSignalIds: string[];
  rejections: number;
}

const segmentKey = (clinicId: string, nationality: string) => `${clinicId}|${nationality}`;

export function aggregateSegments(input: WindowInput): SegmentStats[] {
  const outcomesBySeg = new Map<string, Outcome[]>();
  for (const outcome of input.outcomes) {
    const key = segmentKey(outcome.clinicId, outcome.visitorProfile.nationality);
    outcomesBySeg.set(key, [...(outcomesBySeg.get(key) ?? []), outcome]);
  }

  const callNationality = new Map<string, Nationality>();
  const callsBySeg = new Map<string, number>();
  for (const call of input.quoteCalls) {
    const nationality = nationalityOfCall(call);
    if (!nationality) continue;
    if (call.taskId) callNationality.set(call.taskId, nationality);
    const key = segmentKey(call.to.agentId, nationality);
    callsBySeg.set(key, (callsBySeg.get(key) ?? 0) + 1);
  }

  const timeoutsBySeg = new Map<string, Signal[]>();
  const rejectionsBySeg = new Map<string, number>();
  for (const signal of input.signals) {
    if (signal.kind !== "response_timeout" && signal.kind !== "rejection") continue;
    const nationality = signal.context.nationality ?? (signal.context.taskId ? callNationality.get(signal.context.taskId) : undefined);
    if (!nationality) continue;
    const key = segmentKey(signal.clinicId, nationality);
    if (signal.kind === "response_timeout") timeoutsBySeg.set(key, [...(timeoutsBySeg.get(key) ?? []), signal]);
    else rejectionsBySeg.set(key, (rejectionsBySeg.get(key) ?? 0) + 1);
  }

  const keys = new Set([...outcomesBySeg.keys(), ...callsBySeg.keys(), ...timeoutsBySeg.keys(), ...rejectionsBySeg.keys()]);
  const stats: SegmentStats[] = [];
  for (const key of keys) {
    const [clinicId, nationality] = key.split("|");
    const outcomes = outcomesBySeg.get(key) ?? [];
    const withGap = outcomes.filter((outcome) => typeof outcome.quoteGapRatio === "number");
    const low = outcomes.filter((outcome) => outcome.satisfaction <= LOW_SATISFACTION_MAX);
    const timeouts = timeoutsBySeg.get(key) ?? [];
    const rejections = rejectionsBySeg.get(key) ?? 0;
    const quoteRequests = Math.max(callsBySeg.get(key) ?? 0, timeouts.length + rejections);
    stats.push({
      clinicId,
      nationality,
      n: outcomes.length,
      outcomeIds: outcomes.map((outcome) => outcome.outcomeId),
      gapN: withGap.length,
      meanGap: mean(withGap.map((outcome) => outcome.quoteGapRatio as number)),
      gapOutcomeIds: withGap.map((outcome) => outcome.outcomeId),
      meanSatisfaction: mean(outcomes.map((outcome) => outcome.satisfaction)),
      lowSatisfactionCount: low.length,
      lowSatisfactionRatio: outcomes.length > 0 ? low.length / outcomes.length : null,
      lowSatisfactionOutcomeIds: low.map((outcome) => outcome.outcomeId),
      quoteRequests,
      timeouts: timeouts.length,
      timeoutRatio: quoteRequests > 0 ? timeouts.length / quoteRequests : null,
      timeoutSignalIds: timeouts.map((signal) => signal.id),
      rejections,
    });
  }
  return stats.sort((a, b) => a.clinicId.localeCompare(b.clinicId) || a.nationality.localeCompare(b.nationality));
}

// ---- nationality x area group satisfaction (area preference trigger) ----

export interface AreaGroupStats {
  nationality: Nationality;
  group: AreaGroup;
  n: number;
  meanSatisfaction: number;
  outcomeIds: string[];
}

export function aggregateAreaGroups(input: WindowInput): AreaGroupStats[] {
  const areaOf = new Map(input.registry.map((clinic) => [clinic.id, clinic.area]));
  const buckets = new Map<string, Outcome[]>();
  for (const outcome of input.outcomes) {
    const area = areaOf.get(outcome.clinicId);
    if (!area) continue;
    const key = `${outcome.visitorProfile.nationality}|${areaGroupOf(area)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), outcome]);
  }
  return [...buckets.entries()]
    .map(([key, outcomes]) => {
      const [nationality, group] = key.split("|") as [string, AreaGroup];
      return {
        nationality,
        group,
        n: outcomes.length,
        meanSatisfaction: mean(outcomes.map((outcome) => outcome.satisfaction)) as number,
        outcomeIds: outcomes.map((outcome) => outcome.outcomeId),
      };
    })
    .sort((a, b) => a.nationality.localeCompare(b.nationality) || a.group.localeCompare(b.group));
}

// ---- side effect reports per clinic, all nationalities ----

export interface SideEffectStats {
  clinicId: string;
  count: number;
  outcomeIds: string[];
  signalIds: string[];
}

/** Outcomes with side effects plus side_effect_report signals not already tied to one of those outcomes. */
export function aggregateSideEffects(input: WindowInput): SideEffectStats[] {
  const byClinic = new Map<string, SideEffectStats>();
  const get = (clinicId: string) => {
    let entry = byClinic.get(clinicId);
    if (!entry) {
      entry = { clinicId, count: 0, outcomeIds: [], signalIds: [] };
      byClinic.set(clinicId, entry);
    }
    return entry;
  };
  for (const outcome of input.outcomes) {
    if (outcome.sideEffects.length === 0) continue;
    const entry = get(outcome.clinicId);
    entry.outcomeIds.push(outcome.outcomeId);
    entry.count += 1;
  }
  for (const signal of input.signals) {
    if (signal.kind !== "side_effect_report") continue;
    const entry = get(signal.clinicId);
    entry.signalIds.push(signal.id);
    if (!signal.context.outcomeId || !entry.outcomeIds.includes(signal.context.outcomeId)) entry.count += 1;
  }
  return [...byClinic.values()].filter((entry) => entry.count > 0).sort((a, b) => a.clinicId.localeCompare(b.clinicId));
}

// ---- per clinic view (/ops/signals) ----

export interface ClinicSignalSummary {
  clinicId: string;
  outcomes: number;
  meanGap: number | null;
  gapN: number;
  meanSatisfaction: number | null;
  quoteRequests: number;
  timeouts: number;
  rejections: number;
  noShows: number;
  sideEffectReports: number;
  /** Signals in the window by kind. */
  signalCounts: Partial<Record<Signal["kind"], number>>;
}

export function summarizeClinics(input: WindowInput, segments: SegmentStats[] = aggregateSegments(input)): ClinicSignalSummary[] {
  const ids = new Set([...input.registry.map((clinic) => clinic.id), ...segments.map((segment) => segment.clinicId)]);
  const sideEffects = new Map(aggregateSideEffects(input).map((entry) => [entry.clinicId, entry.count]));
  return [...ids].sort().map((clinicId) => {
    const outcomes = input.outcomes.filter((outcome) => outcome.clinicId === clinicId);
    const gaps = outcomes.filter((outcome) => typeof outcome.quoteGapRatio === "number").map((outcome) => outcome.quoteGapRatio as number);
    const own = segments.filter((segment) => segment.clinicId === clinicId);
    const signalCounts: ClinicSignalSummary["signalCounts"] = {};
    for (const signal of input.signals) {
      if (signal.clinicId !== clinicId) continue;
      signalCounts[signal.kind] = (signalCounts[signal.kind] ?? 0) + 1;
    }
    return {
      clinicId,
      outcomes: outcomes.length,
      meanGap: mean(gaps),
      gapN: gaps.length,
      meanSatisfaction: mean(outcomes.map((outcome) => outcome.satisfaction)),
      quoteRequests: own.reduce((sum, segment) => sum + segment.quoteRequests, 0),
      timeouts: signalCounts.response_timeout ?? 0,
      rejections: signalCounts.rejection ?? 0,
      noShows: signalCounts.no_show ?? 0,
      sideEffectReports: sideEffects.get(clinicId) ?? 0,
      signalCounts,
    };
  });
}

// ---- price distribution (/ops/prices) ----

export interface PriceBand {
  procedureId: string;
  /** An area group, or "seoul" for every area together. */
  region: AreaGroup | "seoul";
  n: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  p90: number | null;
}

/** Verdict sample rule: verified, not a public offer, inside the price window (07 section 1). */
export function isSampleRecord(record: PriceRecord, now: Date, days = PRICE_WINDOW_DAYS): boolean {
  if (!record.verified || record.source === "public_offer") return false;
  const t = Date.parse(`${record.date}T00:00:00+09:00`);
  return t <= now.getTime() && t >= now.getTime() - days * DAY_MS;
}

export function priceDistribution(records: PriceRecord[], now: Date, days = PRICE_WINDOW_DAYS): PriceBand[] {
  const sample = records.filter((record) => isSampleRecord(record, now, days));
  const buckets = new Map<string, number[]>();
  const add = (key: string, value: number) => buckets.set(key, [...(buckets.get(key) ?? []), value]);
  for (const record of sample) {
    add(`${record.procedureId}|${areaGroupOf(record.area)}`, record.normalizedUnitKrw);
    add(`${record.procedureId}|seoul`, record.normalizedUnitKrw);
  }
  const round = (value: number | null) => (value === null ? null : Math.round(value));
  return [...buckets.entries()]
    .map(([key, values]) => {
      const [procedureId, region] = key.split("|") as [string, PriceBand["region"]];
      const sorted = [...values].sort((a, b) => a - b);
      return {
        procedureId,
        region,
        n: sorted.length,
        p25: round(quantile(sorted, 0.25)),
        p50: round(quantile(sorted, 0.5)),
        p75: round(quantile(sorted, 0.75)),
        p90: round(quantile(sorted, 0.9)),
      };
    })
    .sort((a, b) => a.procedureId.localeCompare(b.procedureId) || (a.region === "seoul" ? -1 : b.region === "seoul" ? 1 : a.region.localeCompare(b.region)));
}

// ---- registry freshness (/ops/clinics) ----

export interface RegistryRow extends ClinicRegistryEntry {
  daysSinceVerified: number;
  stale: boolean;
}

export function withFreshness(entry: ClinicRegistryEntry, today: IsoDate): RegistryRow {
  const days = Math.round((Date.parse(today) - Date.parse(entry.lastVerifiedAt)) / DAY_MS);
  return { ...entry, daysSinceVerified: days, stale: days > STALE_AFTER_DAYS };
}

export function clinicDisplayName(entry: Pick<ClinicRegistryEntry, "id" | "name"> | undefined, fallback: string): string {
  if (!entry) return fallback;
  return entry.name.ko ?? entry.name.en ?? entry.name.ja ?? Object.values(entry.name)[0] ?? fallback;
}
