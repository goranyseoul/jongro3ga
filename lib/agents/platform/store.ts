import type {
  AnchorLog,
  AttributionEntry,
  ClinicOfferCache,
  ClinicRegistryEntry,
  JudgedQuote,
  MatchLog,
  Outcome,
  PriceRecord,
  RoutingRule,
  Signal,
  VerifiedVisitStat,
} from "../../domain";
import { COLLECTIONS, getStore } from "../../store";
import type { KrPattern, SeedReviewStat } from "../../store/seed-schemas";

// Adapter over the `platform` store namespace (06-data-model.md). The pure platform modules (fairness, matching,
// rules, ...) never touch the store; their adapters read and write through these functions only.

const C = COLLECTIONS.platform;

/**
 * Collections the platform keeps that 06 has no entity for. They live in the platform namespace next to the
 * COLLECTIONS ones (the memory store accepts any collection name).
 */
export const PLATFORM_EXTRA = {
  /** Every replaced RoutingRule version (07 4절 가드레일 5: "버전 증가 + 이력 보존"). */
  ruleHistory: "rule_history",
  /** Outcomes replaced by a resubmission of the same bookingId + checkpoint (07 3절 "덮어쓰기 + 이력"). */
  outcomeHistory: "outcome_history",
} as const;

/** AttributionEntry plus the booking's quoteId, so an outcome finds the judged quote it was booked from. */
export type StoredAttribution = AttributionEntry & { quoteId?: string };

/** ReviewStat with the published review texts (BUILD-LOG 20 (10)). */
export type StoredReviewStat = SeedReviewStat;

/** Signal kinds of 06 plus `price_outlier` for 07 1절 "이상치는 Signal로 남긴다" (06 has no kind for it). */
export type PlatformSignal = Omit<Signal, "kind"> & { kind: Signal["kind"] | "price_outlier" };

export type HistoryEntry<T> = { id: string; replacedAt: string; value: T };

async function list<T>(collection: string): Promise<T[]> {
  const store = getStore();
  return store.list<T>("platform", collection);
}

async function get<T>(collection: string, id: string): Promise<T | undefined> {
  const store = getStore();
  return store.get<T>("platform", collection, id);
}

async function put<T extends { id: string }>(collection: string, value: T): Promise<void> {
  const store = getStore();
  await store.put("platform", collection, value);
}

async function remove(collection: string, id: string): Promise<void> {
  const store = getStore();
  await store.remove("platform", collection, id);
}

export const platformStore = {
  registry: () => list<ClinicRegistryEntry>(C.clinicRegistry),
  clinic: (clinicId: string) => get<ClinicRegistryEntry>(C.clinicRegistry, clinicId),
  putClinic: (entry: ClinicRegistryEntry) => put(C.clinicRegistry, entry),

  offerCaches: () => list<ClinicOfferCache>(C.offerCache),
  offerCache: (clinicId: string) => get<ClinicOfferCache>(C.offerCache, clinicId),
  putOfferCache: (cache: ClinicOfferCache) => put(C.offerCache, cache),

  priceRecords: () => list<PriceRecord>(C.priceRecords),
  putPriceRecord: (record: PriceRecord) => put(C.priceRecords, record),

  judgedQuotes: () => list<JudgedQuote>(C.judgedQuotes),
  putJudgedQuote: (judged: JudgedQuote) => put(C.judgedQuotes, judged),

  outcomes: () => list<Outcome>(C.outcomes),
  putOutcome: (outcome: Outcome) => put(C.outcomes, outcome),
  putOutcomeHistory: (entry: HistoryEntry<Outcome>) => put(PLATFORM_EXTRA.outcomeHistory, entry),
  outcomeHistory: () => list<HistoryEntry<Outcome>>(PLATFORM_EXTRA.outcomeHistory),

  rules: () => list<RoutingRule>(C.rules),
  rule: (id: string) => get<RoutingRule>(C.rules, id),
  putRule: (rule: RoutingRule) => put(C.rules, rule),
  ruleHistory: () => list<HistoryEntry<RoutingRule>>(PLATFORM_EXTRA.ruleHistory),
  putRuleHistory: (entry: HistoryEntry<RoutingRule>) => put(PLATFORM_EXTRA.ruleHistory, entry),

  matchLogs: () => list<MatchLog>(C.matchLogs),
  matchLog: (id: string) => get<MatchLog>(C.matchLogs, id),
  putMatchLog: (log: MatchLog) => put(C.matchLogs, log),

  attributions: () => list<StoredAttribution>(C.attributions),
  putAttribution: (entry: StoredAttribution) => put(C.attributions, entry),
  async attributionByBooking(bookingId: string): Promise<StoredAttribution | undefined> {
    return (await list<StoredAttribution>(C.attributions)).find((a) => a.bookingId === bookingId);
  },

  signals: () => list<PlatformSignal>(C.signals),
  putSignal: (signal: PlatformSignal) => put(C.signals, signal),
  removeSignal: (id: string) => remove(C.signals, id),

  krPatterns: () => list<KrPattern>(C.krPatterns),

  verifiedVisits: () => list<VerifiedVisitStat>(C.verifiedVisits),
  putVerifiedVisits: (stat: VerifiedVisitStat) => put(C.verifiedVisits, stat),

  reviewStats: () => list<StoredReviewStat>(C.reviewStats),
  putReviewStats: (stat: StoredReviewStat) => put(C.reviewStats, stat),

  anchorLogs: () => list<AnchorLog>(C.anchorLogs),
  putAnchorLog: (log: AnchorLog) => put(C.anchorLogs, log),
};

/** "cln_seoul_glow" + "rejuran_healer" -> "seoul_glow_rejuran_healer", the id stem the seed uses for ZK stats. */
export const statKey = (clinicId: string, procedureId: string): string => `${clinicId.replace(/^cln_/, "")}_${procedureId}`;
