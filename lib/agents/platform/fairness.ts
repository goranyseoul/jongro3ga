// Price and dose verdicts for platform.judge_quote (07 1절). Deterministic, no LLM. Pure functions only;
// the skill adapter in ./skills.ts loads records and outcomes from the platform store.
import type { FairnessVerdictV1, JudgeRequestV1 } from "../../a2a/schemas";
import type { Area, IsoDate, Outcome, PriceRecord, Unit } from "../../domain";
import { getProcedure } from "../../domain/procedure-master";
import { explainVerdict } from "./fairness-copy";
import { regionGroupOf, type RegionGroup } from "./regions";
import { daysBefore, kstDate, mean, quantile, roundHalf } from "./stats";

export type JudgeQuoteInput = JudgeRequestV1["quotes"][number];
type PriceBand = FairnessVerdictV1["priceBand"];
type DoseFlag = FairnessVerdictV1["doseFlag"];
type Label = FairnessVerdictV1["label"];
type Confidence = FairnessVerdictV1["confidence"];
type ClinicFlag = FairnessVerdictV1["clinicFlags"][number];

export const SAMPLE_WINDOW_DAYS = 120;
export const CLINIC_FLAG_WINDOW_DAYS = 90;
export const MIN_SAMPLE = 5;
export const MIN_SAMPLE_FOR_TYPICAL = 10;
export const VAT_RATE = 0.1;

/**
 * Typical dose when the sample is too small (n < 10). The 06 master had `typicalAmount`; the 27 procedure
 * master (lib/domain/procedure.ts) has none, so these demo values stand in (documented in BUILD-LOG).
 */
export const FALLBACK_TYPICAL_AMOUNT: Record<string, { min: number; max: number }> = {
  rejuran_healer: { min: 2, max: 3 },
  skin_booster: { min: 2, max: 3 },
  exosome: { min: 2, max: 5 },
  botox_forehead: { min: 30, max: 50 },
  thermage_flx: { min: 300, max: 600 },
  ulthera: { min: 300, max: 600 },
  shrink_universe: { min: 300, max: 600 },
  skin_booster_juvelook: { min: 1, max: 2 },
  juvelook_volume: { min: 1, max: 2 },
  sculptra: { min: 1, max: 2 },
  filler: { min: 1, max: 2 },
};

// ---- normalization ----

/** 07 "입력 정규화": VAT included total, then per unit. Rounded to whole won. */
export function normalizeQuote(quote: Pick<JudgeQuoteInput, "priceKrw" | "vatIncluded" | "amount">): { totalKrw: number; unitKrw: number } {
  const totalKrw = quote.vatIncluded ? quote.priceKrw : Math.round(quote.priceKrw * (1 + VAT_RATE));
  return { totalKrw, unitKrw: Math.round(totalKrw / quote.amount.value) };
}

// ---- sample ----

export interface PriceSample {
  /** Region group used, or "seoul" when the group had fewer than 5 records. */
  region: RegionGroup | "seoul";
  n: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  typicalAmount: { min: number; max: number; unit: Unit };
  records: PriceRecord[];
  /** Removed as outliers (07: beyond p75 + 3 IQR or below p25 - 3 IQR). */
  outliers: PriceRecord[];
}

export interface SampleQuery {
  procedureId: string;
  /** Area of the quoting clinic. Undefined means the whole of Seoul. */
  area?: Area;
  today: IsoDate;
  product?: string;
}

/** Records eligible for any verdict: same procedure, verified, not a public offer, within 120 days (inclusive). */
export function eligibleRecords(records: readonly PriceRecord[], procedureId: string, today: IsoDate): PriceRecord[] {
  const from = daysBefore(today, SAMPLE_WINDOW_DAYS);
  return records.filter(
    (r) => r.procedureId === procedureId && r.verified && r.source !== "public_offer" && r.date >= from && r.date <= today,
  );
}

function withoutOutliers(records: PriceRecord[]): { kept: PriceRecord[]; outliers: PriceRecord[] } {
  if (records.length < 4) return { kept: records, outliers: [] };
  const units = records.map((r) => r.normalizedUnitKrw);
  const q1 = quantile(units, 0.25);
  const q3 = quantile(units, 0.75);
  const iqr = q3 - q1;
  const hi = q3 + 3 * iqr;
  const lo = q1 - 3 * iqr;
  const kept: PriceRecord[] = [];
  const outliers: PriceRecord[] = [];
  for (const r of records) (r.normalizedUnitKrw > hi || r.normalizedUnitKrw < lo ? outliers : kept).push(r);
  return { kept, outliers };
}

export function procedureUnit(procedureId: string, fallback: Unit = "cc"): Unit {
  return (getProcedure(procedureId)?.unit as Unit | null | undefined) ?? fallback;
}

/** Builds the reference sample R for one quote (07 "기준 표본 R" and "통상 용량"). */
export function buildSample(records: readonly PriceRecord[], query: SampleQuery, unit?: Unit): PriceSample {
  const pool = eligibleRecords(records, query.procedureId, query.today);
  let region: PriceSample["region"] = "seoul";
  let chosen = pool;
  if (query.area) {
    const group = regionGroupOf(query.area);
    const inGroup = pool.filter((r) => regionGroupOf(r.area) === group);
    if (inGroup.length >= MIN_SAMPLE) {
      region = group;
      chosen = inGroup;
    }
  }
  if (query.product) {
    const sameProduct = chosen.filter((r) => r.product === query.product);
    if (sameProduct.length >= MIN_SAMPLE) chosen = sameProduct;
  }
  const { kept, outliers } = withoutOutliers(chosen);
  const units = kept.map((r) => r.normalizedUnitKrw);
  const doseUnit = unit ?? kept[0]?.amount.unit ?? procedureUnit(query.procedureId);
  let typical: { min: number; max: number };
  if (kept.length >= MIN_SAMPLE_FOR_TYPICAL) {
    const amounts = kept.map((r) => r.amount.value);
    typical = { min: roundHalf(quantile(amounts, 0.25)), max: roundHalf(quantile(amounts, 0.75)) };
  } else {
    typical = FALLBACK_TYPICAL_AMOUNT[query.procedureId] ?? { min: Number.NaN, max: Number.NaN };
  }
  return {
    region,
    n: kept.length,
    p25: quantile(units, 0.25),
    p50: quantile(units, 0.5),
    p75: quantile(units, 0.75),
    p90: quantile(units, 0.9),
    typicalAmount: { ...typical, unit: doseUnit },
    records: kept,
    outliers,
  };
}

// ---- verdict pieces ----

export function priceBandFor(x: number, sample: Pick<PriceSample, "n" | "p25" | "p75" | "p90">): PriceBand {
  if (sample.n < MIN_SAMPLE) return "insufficient";
  if (x < sample.p25) return "low";
  if (x <= sample.p75) return "mid";
  if (x <= sample.p90) return "high";
  return "very_high";
}

export function doseFlagFor(amount: number, typical: { min: number; max: number }): DoseFlag {
  if (!Number.isFinite(typical.min) || !Number.isFinite(typical.max)) return "within";
  if (amount < typical.min) return "below_typical";
  if (amount > typical.max * 1.5) return "above_typical";
  return "within";
}

export function labelFor(band: PriceBand, dose: DoseFlag): Label {
  if (dose === "below_typical") return "underdosed";
  if (band === "insufficient") return "insufficient_data";
  return ({ low: "good_deal", mid: "fair", high: "high", very_high: "very_high" } as const)[band];
}

export function confidenceFor(n: number): Confidence {
  if (n >= 30) return "high";
  if (n >= 10) return "medium";
  if (n >= MIN_SAMPLE) return "low";
  return "none";
}

/**
 * Clinic flags (07): paid_more_than_quoted when the clinic's outcomes of the last 90 days average a
 * quoteGapRatio above 0.10 with n >= 3, then indicative_price for proxy-operated clinics.
 */
export function clinicFlagsFor(input: { outcomes: readonly Outcome[]; today: IsoDate; operationMode?: "proxy" | "clinic" }): ClinicFlag[] {
  const from = daysBefore(input.today, CLINIC_FLAG_WINDOW_DAYS);
  const gaps = input.outcomes
    .filter((o) => typeof o.quoteGapRatio === "number")
    .filter((o) => {
      const d = kstDate(o.submittedAt);
      return d >= from && d <= input.today;
    })
    .map((o) => o.quoteGapRatio as number);
  const flags: ClinicFlag[] = [];
  const avg = mean(gaps);
  if (gaps.length >= 3 && avg > 0.1) flags.push({ code: "paid_more_than_quoted", avgGapPct: Math.round(avg * 100) });
  if (input.operationMode === "proxy") flags.push({ code: "indicative_price" });
  return flags;
}

/** Verdict for one quote against a fixed sample (the 07 reference table tests this directly). */
export function verdictFromSample(quote: JudgeQuoteInput, sample: Omit<PriceSample, "records" | "outliers" | "region">, flags: ClinicFlag[]): FairnessVerdictV1 {
  const { unitKrw } = normalizeQuote(quote);
  const band = priceBandFor(unitKrw, sample);
  const typical = Number.isFinite(sample.typicalAmount.min)
    ? sample.typicalAmount
    : { min: quote.amount.value, max: quote.amount.value, unit: quote.amount.unit };
  const dose = doseFlagFor(quote.amount.value, typical);
  const label = labelFor(band, dose);
  const paidMore = flags.find((f) => f.code === "paid_more_than_quoted");
  return {
    quoteId: quote.quoteId,
    normalizedUnitKrw: unitKrw,
    priceBand: band,
    doseFlag: dose,
    typicalAmount: { min: typical.min, max: typical.max, unit: typical.unit },
    clinicFlags: flags,
    label,
    confidence: confidenceFor(sample.n),
    sampleSize: sample.n,
    explanation: explainVerdict({
      label,
      amountValue: quote.amount.value,
      unit: quote.amount.unit,
      typicalMin: typical.min,
      typicalMax: typical.max,
      unitKrw,
      sampleSize: sample.n,
      ...(sample.n >= MIN_SAMPLE ? { p25: Math.round(sample.p25), p75: Math.round(sample.p75), p90: Math.round(sample.p90) } : {}),
      ...(paidMore?.avgGapPct !== undefined ? { paidMoreThanQuotedPct: paidMore.avgGapPct } : {}),
      indicative: flags.some((f) => f.code === "indicative_price"),
    }),
  };
}

export interface ClinicFacts {
  area?: Area;
  operationMode?: "proxy" | "clinic";
  outcomes: readonly Outcome[];
}

/** Full verdict: builds the sample from records, computes clinic flags, then judges. */
export function judgeQuote(input: {
  quote: JudgeQuoteInput;
  records: readonly PriceRecord[];
  clinic: ClinicFacts;
  today: IsoDate;
  product?: string;
}): { verdict: FairnessVerdictV1; sample: PriceSample } {
  const sample = buildSample(
    input.records,
    { procedureId: input.quote.procedureId, area: input.clinic.area, today: input.today, product: input.product },
    input.quote.amount.unit,
  );
  const flags = clinicFlagsFor({ outcomes: input.clinic.outcomes, today: input.today, operationMode: input.clinic.operationMode });
  return { verdict: verdictFromSample(input.quote, sample, flags), sample };
}
