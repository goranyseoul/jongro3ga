// Demo injection of the Ara burst (06-data-model.md seed table "outcomes-ara-burst.json", demo scenario
// row 7 in 10-build-plan.md): 20 outcomes of Japanese customers at Ara whose payment rose above the
// quote. Dates are computed at injection time relative to clock.now() (1 to 29 days back) so the 30 day
// trigger window always contains them; quoteGapRatio runs 0.25 to 0.37 in equal steps, mean 0.31.
// Injected outcomes do not create PriceRecords (07 section 3), so the verdict sample stays at n = 42.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { OutcomeV1Schema } from "../../a2a/schemas";
import type { Outcome, Signal } from "../../domain/platform";
import type { Store } from "../../store/types";
import { DAY_MS, PLATFORM_COLLECTIONS, toKstIso } from "./signals";

export const ARA_BURST = {
  clinicId: "cln_ara",
  nationality: "JP",
  count: 20,
  gapMin: 0.25,
  gapMax: 0.37,
  /** Ara's Rejuran 2cc quote, 300,000 VAT excluded, normalized to VAT included. */
  quotedKrw: 330_000,
  procedureId: "rejuran_healer",
  idPrefix: "out_ara_b",
} as const;

/** Equal steps from gapMin to gapMax, both ends included. */
export function burstGaps(count: number = ARA_BURST.count): number[] {
  return Array.from({ length: count }, (_, i) => {
    const value = ARA_BURST.gapMin + ((ARA_BURST.gapMax - ARA_BURST.gapMin) * i) / (count - 1);
    return Math.round(value * 1e6) / 1e6;
  });
}

/** Spreads `count` outcomes over 1..29 days before now, oldest first. */
export function burstDaysAgo(count: number = ARA_BURST.count): number[] {
  return Array.from({ length: count }, (_, i) => 29 - Math.round((28 * i) / Math.max(1, count - 1)));
}

const outcomeIdOf = (i: number) => `${ARA_BURST.idPrefix}${String(i + 1).padStart(2, "0")}`;

/** The burst built in code, used when data/seed/outcomes-ara-burst.json is absent or not usable. */
export function buildAraBurst(now: Date): Outcome[] {
  const gaps = burstGaps();
  const days = burstDaysAgo();
  return gaps.map((gap, i) => {
    const at = toKstIso(new Date(now.getTime() - days[i] * DAY_MS));
    const n = String(i + 1).padStart(2, "0");
    return {
      schema: "pibu/outcome@1",
      id: outcomeIdOf(i),
      outcomeId: outcomeIdOf(i),
      bookingId: `bkg_ara_b${n}`,
      clinicId: ARA_BURST.clinicId,
      procedureId: ARA_BURST.procedureId,
      checkpoint: "D0",
      paidKrw: Math.round(ARA_BURST.quotedKrw * (1 + gap)),
      receivedAmount: { value: 2, unit: "cc" },
      productVerified: "box_shown",
      receiptAttached: true,
      satisfaction: 3,
      painScore: 3,
      downtimeDaysActual: 1,
      wouldReturn: false,
      sideEffects: [],
      visitorProfile: { nationality: ARA_BURST.nationality, ageBand: i % 2 === 0 ? "25-29" : "30-34" },
      submittedAt: at,
      receivedAt: at,
      quotedKrw: ARA_BURST.quotedKrw,
      quoteGapRatio: gap,
    } satisfies Outcome;
  });
}

/**
 * Uses the seed template when it exists and parses: its outcome fields are kept, ids, dates and the
 * gap are recomputed so the window and the mean always hold. Returns null when it cannot be used.
 */
export function fromTemplate(raw: unknown, now: Date): Outcome[] | null {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { outcomes?: unknown })?.outcomes) ? (raw as { outcomes: unknown[] }).outcomes : null;
  if (!list || list.length !== ARA_BURST.count) return null;
  const base = buildAraBurst(now);
  const out: Outcome[] = [];
  for (const [i, item] of list.entries()) {
    if (typeof item !== "object" || item === null) return null;
    const merged = { ...(item as Record<string, unknown>) };
    const fixed = base[i];
    const v1Keys = Object.keys(OutcomeV1Schema.shape);
    const candidate = Object.fromEntries(
      v1Keys.map((key) => [key, merged[key] ?? (fixed as unknown as Record<string, unknown>)[key]]),
    );
    candidate.outcomeId = fixed.outcomeId;
    candidate.clinicId = fixed.clinicId;
    candidate.submittedAt = fixed.submittedAt;
    candidate.paidKrw = fixed.paidKrw;
    candidate.visitorProfile = { ...(fixed.visitorProfile as object), ...((merged.visitorProfile as object) ?? {}), nationality: ARA_BURST.nationality };
    for (const key of Object.keys(candidate)) if (candidate[key] === undefined) delete candidate[key];
    const parsed = OutcomeV1Schema.safeParse(candidate);
    if (!parsed.success) return null;
    out.push({ ...parsed.data, id: fixed.id, receivedAt: fixed.receivedAt, quotedKrw: fixed.quotedKrw, quoteGapRatio: fixed.quoteGapRatio });
  }
  return out;
}

/** The quote_gap signal platform.submit_outcome would record for each (> 0.10). */
export function burstSignals(outcomes: Outcome[]): Signal[] {
  return outcomes
    .filter((outcome) => (outcome.quoteGapRatio ?? 0) > 0.1)
    .map((outcome) => ({
      id: `sig_${outcome.outcomeId.slice("out_".length)}`,
      clinicId: outcome.clinicId,
      kind: "quote_gap",
      value: outcome.quoteGapRatio as number,
      context: { nationality: outcome.visitorProfile.nationality, procedureId: outcome.procedureId, outcomeId: outcome.outcomeId },
      at: outcome.receivedAt,
    }));
}

export const BURST_TEMPLATE_PATH = path.join("data", "seed", "outcomes-ara-burst.json");

export interface InjectResult {
  injected: number;
  meanGap: number;
  meanGapPct: number;
  outcomeIds: string[];
  from: string;
  to: string;
  source: "seed_template" | "builtin";
}

/** Writes the burst (outcomes and their quote_gap signals). Injecting twice overwrites the same ids. */
export async function injectAraBurst(store: Store, now: Date, root: string = process.cwd()): Promise<InjectResult> {
  let outcomes: Outcome[] | null = null;
  let source: InjectResult["source"] = "builtin";
  try {
    const raw = JSON.parse(await readFile(path.join(root, BURST_TEMPLATE_PATH), "utf8"));
    outcomes = fromTemplate(raw, now);
    if (outcomes) source = "seed_template";
  } catch {
    outcomes = null;
  }
  outcomes ??= buildAraBurst(now);

  for (const outcome of outcomes) await store.put("platform", PLATFORM_COLLECTIONS.outcomes, outcome);
  for (const signal of burstSignals(outcomes)) await store.put("platform", PLATFORM_COLLECTIONS.signals, signal);

  const gaps = outcomes.map((outcome) => outcome.quoteGapRatio as number);
  const meanGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  const times = outcomes.map((outcome) => outcome.submittedAt).sort();
  return {
    injected: outcomes.length,
    meanGap,
    meanGapPct: Math.round(meanGap * 100),
    outcomeIds: outcomes.map((outcome) => outcome.outcomeId),
    from: times[0],
    to: times[times.length - 1],
    source,
  };
}

/** How many burst outcomes are currently in the store (demo state panel). */
export async function countInjected(store: Store): Promise<number> {
  const outcomes = await store.list<Outcome>("platform", PLATFORM_COLLECTIONS.outcomes);
  return outcomes.filter((outcome) => outcome.outcomeId.startsWith(ARA_BURST.idPrefix)).length;
}
