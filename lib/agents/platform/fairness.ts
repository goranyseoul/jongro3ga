import type { FairnessVerdictListV1, FairnessVerdictV1, JudgeRequestV1 } from "../../a2a/schemas";
import { clock } from "../../clock";
import type { Amount, Area, ClinicRegistryEntry, JudgedQuote, Outcome, PriceRecord } from "../../domain";
import { fairnessExplanation } from "./fairness-copy";
import { procedureFacts } from "./procedure-facts";
import {
  dateWithinDays,
  mean,
  normalizedTotalKrw,
  quantile,
  regionGroupOf,
  round,
  roundHalf,
  withinDays,
  type RegionGroup,
} from "./stats";
import { platformStore, type PlatformSignal } from "./store";

// Price and dose verdicts, 07 1절 (platform.judge_quote). Deterministic: the same records and quote give the same
// verdict. Pure functions first, the store adapter (`judgeQuotes`) at the bottom.

export const SAMPLE_WINDOW_DAYS = 120;
export const CLINIC_FLAG_WINDOW_DAYS = 90;
const MIN_SAMPLE = 5;

// ---- reference sample ----

export interface SampleSelection {
  records: PriceRecord[];
  /** Region group the sample came from, or "seoul" when the group had fewer than 5 records. */
  region: RegionGroup | "seoul";
  /** Records dropped as 3 IQR outliers (07: kept as Signals). */
  outliers: PriceRecord[];
}

export interface SampleQuery {
  procedureId: string;
  /** Region group to try first. */
  region: RegionGroup | "seoul";
  /** Product filter, applied only when it leaves 5 or more records. */
  product?: string;
  now: Date;
}

/** 07 1절 기준 표본 R. */
export function selectReferenceSample(records: readonly PriceRecord[], query: SampleQuery): SampleSelection {
  const base = records.filter(
    (r) =>
      r.procedureId === query.procedureId &&
      r.verified &&
      r.source !== "public_offer" &&
      dateWithinDays(r.date, query.now, SAMPLE_WINDOW_DAYS),
  );
  let region: SampleSelection["region"] = query.region;
  let sample = query.region === "seoul" ? base : base.filter((r) => regionGroupOf(r.area) === query.region);
  if (sample.length < MIN_SAMPLE) {
    region = "seoul";
    sample = base;
  }
  if (query.product) {
    const sameProduct = sample.filter((r) => r.product === query.product);
    if (sameProduct.length >= MIN_SAMPLE) sample = sameProduct;
  }
  const units = sample.map((r) => r.normalizedUnitKrw);
  const q25 = quantile(units, 0.25);
  const q75 = quantile(units, 0.75);
  const iqr = q75 - q25;
  const isOutlier = (r: PriceRecord) => r.normalizedUnitKrw > q75 + 3 * iqr || r.normalizedUnitKrw < q25 - 3 * iqr;
  return { records: sample.filter((r) => !isOutlier(r)), region, outliers: sample.filter(isOutlier) };
}

export interface PriceReference {
  region: RegionGroup | "seoul";
  n: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  /** 07 통상 용량: sample p25~p75 of amounts when n >= 10, else the procedure master value. */
  typicalAmount?: { min: number; max: number };
}

/** Quantiles (whole won) and typical amount of a selected sample. */
export function buildReference(selection: Pick<SampleSelection, "records" | "region">, masterTypical?: { min: number; max: number }): PriceReference {
  const units = selection.records.map((r) => r.normalizedUnitKrw);
  const amounts = selection.records.map((r) => r.amount.value);
  const n = units.length;
  const typicalAmount =
    n >= 10 ? { min: roundHalf(quantile(amounts, 0.25)), max: roundHalf(quantile(amounts, 0.75)) } : masterTypical;
  return {
    region: selection.region,
    n,
    p25: Math.round(quantile(units, 0.25)),
    p50: Math.round(quantile(units, 0.5)),
    p75: Math.round(quantile(units, 0.75)),
    p90: Math.round(quantile(units, 0.9)),
    ...(typicalAmount ? { typicalAmount } : {}),
  };
}

// ---- verdict ----

export type ClinicFlag = FairnessVerdictV1["clinicFlags"][number];

/** 07 병원 플래그: 90 day outcomes of the clinic with mean quoteGapRatio > 0.10 and n >= 3, and proxy operation. */
export function clinicFlagsFor(input: { outcomes: readonly Outcome[]; operationMode: ClinicRegistryEntry["operationMode"]; now: Date }): ClinicFlag[] {
  const gaps = input.outcomes
    .filter((o) => o.quoteGapRatio !== undefined && withinDays(o.submittedAt, input.now, CLINIC_FLAG_WINDOW_DAYS))
    .map((o) => o.quoteGapRatio as number);
  const flags: ClinicFlag[] = [];
  // Gaps are stored to 6 decimals; rounding keeps float noise (0.1 + 0.1 + 0.1) from crossing the 0.10 line.
  const avg = round(mean(gaps), 6);
  if (gaps.length >= 3 && avg > 0.1) flags.push({ code: "paid_more_than_quoted", avgGapPct: Math.round(avg * 100) });
  if (input.operationMode === "proxy") flags.push({ code: "indicative_price" });
  return flags;
}

export function confidenceOf(n: number): FairnessVerdictV1["confidence"] {
  if (n >= 30) return "high";
  if (n >= 10) return "medium";
  if (n >= MIN_SAMPLE) return "low";
  return "none";
}

export function priceBandOf(unitKrw: number, ref: PriceReference): FairnessVerdictV1["priceBand"] {
  if (ref.n < MIN_SAMPLE) return "insufficient";
  if (unitKrw < ref.p25) return "low";
  if (unitKrw <= ref.p75) return "mid";
  if (unitKrw <= ref.p90) return "high";
  return "very_high";
}

export function doseFlagOf(value: number, typical: { min: number; max: number }): FairnessVerdictV1["doseFlag"] {
  if (value < typical.min) return "below_typical";
  if (value > typical.max * 1.5) return "above_typical";
  return "within";
}

const LABEL_OF_BAND: Record<Exclude<FairnessVerdictV1["priceBand"], "insufficient">, FairnessVerdictV1["label"]> = {
  low: "good_deal",
  mid: "fair",
  high: "high",
  very_high: "very_high",
};

export interface QuoteToJudge {
  quoteId: string;
  amount: Amount;
  priceKrw: number;
  vatIncluded: boolean;
}

/** One verdict (07 1절 계산 표). Pure. */
export function judgeQuote(quote: QuoteToJudge, ref: PriceReference, clinicFlags: readonly ClinicFlag[]): FairnessVerdictV1 {
  const total = normalizedTotalKrw(quote.priceKrw, quote.vatIncluded);
  const unit = Math.round(total / quote.amount.value);
  const priceBand = priceBandOf(unit, ref);
  // No master value and no sample: the quoted amount is the only reference, so the dose is "within".
  const typical = ref.typicalAmount ?? { min: quote.amount.value, max: quote.amount.value };
  const doseFlag = doseFlagOf(quote.amount.value, typical);
  const label: FairnessVerdictV1["label"] =
    doseFlag === "below_typical" ? "underdosed" : priceBand === "insufficient" ? "insufficient_data" : LABEL_OF_BAND[priceBand];
  return {
    quoteId: quote.quoteId,
    normalizedUnitKrw: unit,
    priceBand,
    doseFlag,
    typicalAmount: { ...typical, unit: quote.amount.unit },
    clinicFlags: [...clinicFlags],
    label,
    confidence: confidenceOf(ref.n),
    sampleSize: ref.n,
    explanation: fairnessExplanation({ amount: quote.amount, typicalAmount: typical, priceBand, doseFlag, clinicFlags: [...clinicFlags] }),
  };
}

/** Reference for one procedure at one clinic location, from raw records. Pure. */
export function referenceFor(
  records: readonly PriceRecord[],
  input: { procedureId: string; area?: Area; region?: RegionGroup | "seoul"; product?: string; now: Date },
): { reference: PriceReference; selection: SampleSelection } {
  const region = input.region ?? (input.area ? regionGroupOf(input.area) : "seoul");
  const selection = selectReferenceSample(records, { procedureId: input.procedureId, region, product: input.product, now: input.now });
  return { reference: buildReference(selection, procedureFacts(input.procedureId)?.typicalAmount), selection };
}

// ---- adapter ----

/** Outlier records as Signals, one per record (id is stable, so judging again does not duplicate them). */
async function recordOutliers(outliers: readonly PriceRecord[], at: string): Promise<void> {
  for (const record of outliers) {
    const signal: PlatformSignal = {
      id: `sig_outlier_${record.id}`,
      clinicId: record.clinicId ?? "unknown",
      kind: "price_outlier",
      value: record.normalizedUnitKrw,
      context: { procedureId: record.procedureId },
      at,
    };
    await platformStore.putSignal(signal);
  }
}

/** platform.judge_quote: verdicts for every quote, each kept as a JudgedQuote for the outcome's quoteGapRatio. */
export async function judgeQuotes(request: JudgeRequestV1): Promise<FairnessVerdictListV1> {
  const now = clock.now();
  const at = clock.nowIso();
  const [registry, records, outcomes] = await Promise.all([
    platformStore.registry(),
    platformStore.priceRecords(),
    platformStore.outcomes(),
  ]);
  const verdicts: FairnessVerdictV1[] = [];
  for (const quote of request.quotes) {
    const clinic = registry.find((c) => c.id === quote.clinicId);
    const { reference, selection } = referenceFor(records, { procedureId: quote.procedureId, area: clinic?.area, now });
    await recordOutliers(selection.outliers, at);
    const flags = clinic
      ? clinicFlagsFor({ outcomes: outcomes.filter((o) => o.clinicId === clinic.id), operationMode: clinic.operationMode, now })
      : [];
    const verdict = judgeQuote(quote, reference, flags);
    verdicts.push(verdict);
    const judged: JudgedQuote = {
      id: `jq_${quote.quoteId}`,
      quoteId: quote.quoteId,
      matchId: request.matchId,
      clinicId: quote.clinicId,
      quote,
      verdict,
      at,
    };
    await platformStore.putJudgedQuote(judged);
  }
  return { schema: "pibu/fairness-verdict-list@1", requestId: request.requestId, verdicts };
}
