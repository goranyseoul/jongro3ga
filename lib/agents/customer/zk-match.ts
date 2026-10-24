import { OffersV1Schema, type OfferProofV1, type OffersV1, type ZkClause } from "../../a2a/schemas";
import type { IsoDate, TreatmentRecord, ZkChart } from "../../domain";
import { N, offerEligible, toCircuitClause } from "../../zk/clauses";
import { clinicCode, procedureCode } from "../../zk/codes";
import { parsePublicOffers, type PublicOffer } from "../../zk/browser/offers";
import { proveOffer, toOfferProof } from "../../zk/client";
import { isClinicConfirmed } from "./records";
import { daysBetween } from "./schedule";

// Device side offer matching (02 "기록 지갑과 오퍼 증명", INTEGRATION 3 and 4, T18 customer side).
//
// 1. The clinic's `clinic.offers` items carry `event.zkClauses` for record based offers.
// 2. The wallet builds the chart from clinic confirmed records only and evaluates the clauses here, with
//    lib/zk/clauses (the circuit's predicate). Nothing leaves the agent for this step.
// 3. Only for an offer that holds does it ask the wallet server for a proof. A clinic whose offers do not
//    hold gets no proof request and no proof (a failed proof would itself leak history).

/** Chain clock: one "day" of the registry is 60 seconds (INTEGRATION 7). */
export const CHAIN_DAY_MS = 60_000;

/** The registry's day number for a time, the `today` of clauses and proofs. */
export const chainToday = (now: Date): number => Math.floor(now.getTime() / CHAIN_DAY_MS);

/** The circuit code of an id, or undefined for an id the circuits do not know (such a record is left out). */
const codeOf = (lookup: (id: string) => number, id: string): number | undefined => {
  try {
    return lookup(id);
  } catch {
    return undefined;
  }
};

/**
 * The private chart: up to N clinic confirmed records (newest first), circuit codes for procedure and clinic.
 * A record dated d calendar days before `todayDate` gets chain day `today - d`, so a clause's minDays/maxDays
 * read as calendar days; a record in the future (a booking not yet visited) never counts. Empty slots are 0.
 */
export function buildChart(records: readonly TreatmentRecord[], today: number, todayDate: IsoDate): ZkChart {
  const rows = records
    .filter(isClinicConfirmed)
    .map((r) => ({ r, type: codeOf(procedureCode, r.procedureId), clinic: codeOf(clinicCode, r.clinicId ?? "") }))
    .filter((row): row is { r: TreatmentRecord; type: number; clinic: number } => row.type !== undefined && row.clinic !== undefined)
    .sort((a, b) => b.r.date.localeCompare(a.r.date))
    .slice(0, N);
  const chart: ZkChart = { types: Array(N).fill(0), dates: Array(N).fill(0), clinics: Array(N).fill(0), salt: "0" };
  rows.forEach(({ r, type, clinic }, i) => {
    chart.types[i] = type;
    chart.clinics[i] = clinic;
    chart.dates[i] = Math.max(1, today - daysBetween(r.date, todayDate));
  });
  return chart;
}

export interface ZkOfferItem {
  clinicId: string;
  procedureId: string;
  priceKrw: number;
  title: string;
  zkClauses: ZkClause[];
}

/** The record based (proof only) items of a pibu/offers@1 for one procedure that run on `todayDate`. */
export function zkOfferItems(offers: OffersV1, procedureId: string, todayDate: IsoDate): ZkOfferItem[] {
  return offers.items.flatMap((item) => {
    const event = item.event;
    if (!event?.zkClauses || item.procedureId !== procedureId) return [];
    if (event.validFrom > todayDate || event.validUntil < todayDate) return [];
    return [{ clinicId: offers.clinicId, procedureId, priceKrw: item.priceKrw, title: event.title, zkClauses: event.zkClauses }];
  });
}

/** Parses a clinic.offers artifact, or undefined. */
export function parseOffers(data: unknown): OffersV1 | undefined {
  const parsed = OffersV1Schema.safeParse(data);
  return parsed.success ? parsed.data : undefined;
}

const sameClauses = (a: readonly ZkClause[], b: readonly ZkClause[]): boolean => {
  const key = (clauses: readonly ZkClause[]) =>
    clauses
      .map((c) => JSON.stringify(toCircuitClause(c)))
      .sort()
      .join("|");
  return key(a) === key(b);
};

/**
 * The offer id of a clinic's record based event. pibu/offers@1 items carry no id, so the wallet looks the event
 * up in the public offer catalog (glowpass GET /api/offers) by clinic and identical clauses.
 */
export function offerIdFor(item: ZkOfferItem, catalog: readonly PublicOffer[]): string | undefined {
  return catalog.find((offer) => offer.clinicId === item.clinicId && sameClauses(offer.clauses, item.zkClauses))?.id;
}

export interface OfferPlan {
  clinicId: string;
  /** Items whose clauses hold on the chart, cheapest first. */
  eligible: ZkOfferItem[];
  /** Items whose clauses do not hold. */
  ineligible: ZkOfferItem[];
}

/** Evaluates every record based item of every clinic on the chart. Pure. */
export function planOffers(input: {
  chart: ZkChart;
  today: number;
  todayDate: IsoDate;
  procedureId: string;
  offersByClinic: ReadonlyMap<string, OffersV1>;
}): OfferPlan[] {
  const plans: OfferPlan[] = [];
  for (const [clinicId, offers] of input.offersByClinic) {
    const items = zkOfferItems(offers, input.procedureId, input.todayDate);
    if (items.length === 0) continue;
    const eligible = items.filter((item) => offerEligible(input.chart, input.today, item.zkClauses)).sort((a, b) => a.priceKrw - b.priceKrw);
    const ineligible = items.filter((item) => !eligible.includes(item));
    plans.push({ clinicId, eligible, ineligible });
  }
  return plans;
}

/** The offer-proof@1 metadata value, plus `unanchored` when the wallet has no chain record yet (BUILD-LOG 22 (2)). */
export type OfferProofMetadata = OfferProofV1 & { unanchored?: true };

export type ProofOutcome =
  | { ok: true; offerId: string; proof: OfferProofMetadata }
  | { ok: false; offerId?: string; reason: "no_offer_id" | "prove_failed"; detail?: string };

/** Asks the wallet server for the proof of one eligible item (lib/zk/client.proveOffer). Never throws. */
export async function proveItem(persona: string, item: ZkOfferItem, catalog: readonly PublicOffer[]): Promise<ProofOutcome> {
  const offerId = offerIdFor(item, catalog);
  if (!offerId) return { ok: false, reason: "no_offer_id" };
  try {
    const bundle = await proveOffer(persona, offerId);
    return { ok: true, offerId, proof: { ...toOfferProof(bundle, item.clinicId), ...(bundle.unanchored ? { unanchored: true as const } : {}) } };
  } catch (error) {
    return { ok: false, offerId, reason: "prove_failed", detail: error instanceof Error ? error.message : String(error) };
  }
}

/** glowpass knows wallets by customer id; Yuki's finished profile shares Yuki's wallet (INTEGRATION 2, BUILD-LOG 23 (9)). */
const PERSONA_ALIAS: Record<string, string> = { cus_yuki_done: "cus_yuki" };
export const personaOf = (customerId: string): string => PERSONA_ALIAS[customerId] ?? customerId;

/** The public offer catalog of the wallet server (no persona is sent). Empty when the server is unreachable. */
export async function loadOfferCatalog(fetchImpl: typeof fetch = fetch): Promise<PublicOffer[]> {
  const base = (process.env.ZK_SERVER_URL ?? "http://localhost:4000").replace(/\/+$/, "");
  try {
    const res = await fetchImpl(`${base}/api/offers`, { cache: "no-store", signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return [];
    return parsePublicOffers(await res.json());
  } catch {
    return [];
  }
}
