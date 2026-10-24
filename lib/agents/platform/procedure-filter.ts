import type { AgeBand, IsoDate, Krw } from "../../domain/common";
import type { BodyPart, Pain, Procedure, ProcedureArea, ProcedureMethod } from "../../domain/procedure";
import { procedureMaster } from "../../domain/procedure-master";

// "피북 필터" from PLANNING.md 8-8: concern area -> body part -> conditions -> ranked procedure cards.
// Pure function over the procedure master, no clock and no LLM, so the same input always gives the same cards.

/** Maximum points per criterion. A criterion the visitor did not state counts as fully satisfied. */
export const SCORE = { area: 40, part: 20, selection: 20, budget: 10, pain: 10 } as const;

export interface ProcedureFilterInput {
  /** Concern areas (step 1). At least one. A procedure must match one of them to be a candidate. */
  areas: ProcedureArea[];
  /** Body parts (step 2). A procedure that avoids one of them is excluded. */
  parts?: BodyPart[];
  /** Only these treatment methods. Left out when the visitor does not know. */
  methods?: ProcedureMethod[];
  /** Never these methods, e.g. injection and thread for "비침습". */
  excludeMethods?: ProcedureMethod[];
  /** Downtime the visitor accepts in days: 0 same day, 3 for "1~3일 OK", 7 for a week. */
  maxDowntimeDays?: number;
  /** Highest pain the visitor accepts. Above it a warning is shown, the treatment is not removed. */
  maxPain?: Pain;
  /** Budget for one visit. */
  budgetKrw?: Krw;
  /** The effect must last: upkeep every N days or less often, e.g. 300 for "연 1회". */
  minMaintenanceDays?: number;
  /** Shortest gap between the visitor's visits in days. A starting series that needs shorter gaps is out. */
  visitGapDays?: number;
  /** Foreign visitors: treatment is assumed on the arrival day, the earliest possible. */
  trip?: { arrival: IsoDate; departure: IsoDate };
  ageBand?: AgeBand;
}

export interface ProcedureFilterContext {
  procedures?: readonly Procedure[];
  /** Share (0 to 1) of Korean women of the same age band who chose the procedure. Defaults to 0. */
  selectionRate?: (procedureId: string, ageBand: AgeBand | undefined) => number;
}

export type ExclusionReason =
  | { code: "avoid_part"; part: BodyPart; reason: string }
  | { code: "method_not_selected" }
  | { code: "method_excluded"; methods: ProcedureMethod[] }
  | { code: "downtime_too_long"; downtimeMaxDays: number; limitDays: number }
  | {
      code: "downtime_after_departure";
      earliestEnd: IsoDate;
      departure: IsoDate;
      /** Days the stay would have to be extended for the best case to work. */
      extendDays: number;
      suggestion: "check_stay_extension";
    }
  | { code: "cycle_too_frequent"; intervalDays: number; limitDays: number }
  | { code: "series_too_close"; intervalDays: number; visitGapDays: number };

export type Warning =
  | {
      code: "downtime_may_overlap_departure";
      latestEnd: IsoDate;
      departure: IsoDate;
      /** Days the downtime could run past the departure day. */
      daysOver: number;
      suggestion: "check_stay_extension";
    }
  | { code: "downtime_unknown" }
  | { code: "pain_above_preference"; pain: Pain }
  | { code: "over_budget" }
  | { code: "price_unknown" };

export interface ScoreBreakdown {
  area: number;
  part: number;
  selection: number;
  budget: number;
  pain: number;
}

export interface RankedProcedure {
  procedure: Procedure;
  score: number;
  breakdown: ScoreBreakdown;
  warnings: Warning[];
}

export interface ExcludedProcedure {
  procedure: Procedure;
  reasons: ExclusionReason[];
}

export interface ProcedureFilterResult {
  /** Best first. Ties go to the higher selection rate, then to the id. */
  ranked: RankedProcedure[];
  /** Procedures of the requested areas that failed a condition, with why. The agent explains these ("이번 일정에서는 뺐어요"). */
  excluded: ExcludedProcedure[];
}

const PAIN_RANK: Record<Pain, number> = { low: 0, mid: 1, high: 2 };
const DAY_MS = 86_400_000;

const dayNumber = (date: IsoDate): number => {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year!, month! - 1, day!) / DAY_MS;
};
const addDays = (date: IsoDate, days: number): IsoDate => new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function filterProcedures(input: ProcedureFilterInput, context: ProcedureFilterContext = {}): ProcedureFilterResult {
  if (input.areas.length === 0) throw new TypeError("at least one concern area is required");
  if (input.trip && dayNumber(input.trip.arrival) > dayNumber(input.trip.departure)) {
    throw new TypeError("trip.arrival must not be after trip.departure");
  }

  const procedures = context.procedures ?? procedureMaster;
  const rateOf = (procedure: Procedure) => clamp01(context.selectionRate?.(procedure.id, input.ageBand) ?? 0);

  const ranked: Array<RankedProcedure & { rate: number }> = [];
  const excluded: ExcludedProcedure[] = [];

  for (const procedure of procedures) {
    const matchedAreas = input.areas.filter((area) => procedure.areas.includes(area));
    if (matchedAreas.length === 0) continue;

    const reasons = exclusionReasons(procedure, input);
    if (reasons.length > 0) {
      excluded.push({ procedure, reasons });
      continue;
    }

    const rate = rateOf(procedure);
    const breakdown: ScoreBreakdown = {
      area: (SCORE.area * matchedAreas.length) / input.areas.length,
      part: partScore(procedure, input),
      selection: SCORE.selection * rate,
      budget: budgetScore(procedure, input),
      pain: painScore(procedure, input),
    };
    const score = breakdown.area + breakdown.part + breakdown.selection + breakdown.budget + breakdown.pain;
    ranked.push({ procedure, score, breakdown, warnings: warningsFor(procedure, input), rate });
  }

  ranked.sort((a, b) => b.score - a.score || b.rate - a.rate || a.procedure.id.localeCompare(b.procedure.id));
  excluded.sort((a, b) => a.procedure.id.localeCompare(b.procedure.id));

  return { ranked: ranked.map(({ rate: _rate, ...card }) => card), excluded };
}

function exclusionReasons(procedure: Procedure, input: ProcedureFilterInput): ExclusionReason[] {
  const reasons: ExclusionReason[] = [];

  for (const avoid of procedure.avoidParts) {
    if (input.parts?.includes(avoid.part)) reasons.push({ code: "avoid_part", part: avoid.part, reason: avoid.reason });
  }

  if (input.methods && input.methods.length > 0 && !procedure.methods.some((method) => input.methods!.includes(method))) {
    reasons.push({ code: "method_not_selected" });
  }
  const banned = procedure.methods.filter((method) => input.excludeMethods?.includes(method));
  if (banned.length > 0) reasons.push({ code: "method_excluded", methods: banned });

  const downtime = procedure.downtimeDays;
  // The visitor's own limit uses the upper end: "no downtime" must be reliable.
  if (input.maxDowntimeDays !== undefined && downtime && downtime.max > input.maxDowntimeDays) {
    reasons.push({ code: "downtime_too_long", downtimeMaxDays: downtime.max, limitDays: input.maxDowntimeDays });
  }
  // The trip only removes what cannot work even in the best case: treated on arrival, shortest downtime.
  if (input.trip && downtime) {
    const earliestEnd = addDays(input.trip.arrival, downtime.min);
    if (dayNumber(earliestEnd) > dayNumber(input.trip.departure)) {
      reasons.push({
        code: "downtime_after_departure",
        earliestEnd,
        departure: input.trip.departure,
        extendDays: dayNumber(earliestEnd) - dayNumber(input.trip.departure),
        suggestion: "check_stay_extension",
      });
    }
  }

  if (input.minMaintenanceDays !== undefined) {
    const upkeep = procedure.cycle.maintenanceIntervalDays;
    if (upkeep && upkeep.min < input.minMaintenanceDays) {
      reasons.push({ code: "cycle_too_frequent", intervalDays: upkeep.min, limitDays: input.minMaintenanceDays });
    }
  }
  if (input.visitGapDays !== undefined) {
    const series = procedure.cycle.initial;
    const repeats = series && (series.count === null || series.count > 1);
    if (series && repeats && series.intervalDays < input.visitGapDays) {
      reasons.push({ code: "series_too_close", intervalDays: series.intervalDays, visitGapDays: input.visitGapDays });
    }
  }

  return reasons;
}

function warningsFor(procedure: Procedure, input: ProcedureFilterInput): Warning[] {
  const warnings: Warning[] = [];
  const downtime = procedure.downtimeDays;

  if (!downtime && (input.maxDowntimeDays !== undefined || input.trip)) warnings.push({ code: "downtime_unknown" });
  if (input.trip && downtime) {
    const latestEnd = addDays(input.trip.arrival, downtime.max);
    if (dayNumber(latestEnd) > dayNumber(input.trip.departure)) {
      warnings.push({
        code: "downtime_may_overlap_departure",
        latestEnd,
        departure: input.trip.departure,
        daysOver: dayNumber(latestEnd) - dayNumber(input.trip.departure),
        suggestion: "check_stay_extension",
      });
    }
  }
  if (input.maxPain && procedure.pain && PAIN_RANK[procedure.pain] > PAIN_RANK[input.maxPain]) {
    warnings.push({ code: "pain_above_preference", pain: procedure.pain });
  }
  if (input.budgetKrw !== undefined) {
    if (!procedure.priceKrw) warnings.push({ code: "price_unknown" });
    else if (procedure.priceKrw.min > input.budgetKrw) warnings.push({ code: "over_budget" });
  }
  return warnings;
}

function partScore(procedure: Procedure, input: ProcedureFilterInput): number {
  if (!input.parts || input.parts.length === 0) return SCORE.part;
  if (input.parts.some((part) => procedure.recommendedParts.includes(part))) return SCORE.part;
  if (input.parts.some((part) => procedure.bodyParts.includes(part))) return SCORE.part / 2;
  return 0;
}

function budgetScore(procedure: Procedure, input: ProcedureFilterInput): number {
  if (input.budgetKrw === undefined) return SCORE.budget;
  const price = procedure.priceKrw;
  if (!price) return 0;
  if (price.max <= input.budgetKrw) return SCORE.budget;
  if (price.min <= input.budgetKrw) return SCORE.budget / 2;
  return 0;
}

function painScore(procedure: Procedure, input: ProcedureFilterInput): number {
  if (!input.maxPain) return SCORE.pain;
  if (!procedure.pain) return 0;
  return PAIN_RANK[procedure.pain] <= PAIN_RANK[input.maxPain] ? SCORE.pain : 0;
}
