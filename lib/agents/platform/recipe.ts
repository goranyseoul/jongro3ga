// platform.recipe skill handler (07-platform-intelligence.md section 5, "PibooK Recipe"). OWNER: track LLM.
// What Korean women of the same age band chose for the same concern, plus the procedure master's typical
// amount, cycle, downtime and onset. Pure data, no LLM, no medical advice wording: the disclaimer only says
// where the numbers come from and that the doctor decides.
import type { SkillHandler } from "@/lib/a2a/contract";
import { RecipeV1Schema, type RecipeQueryV1, type RecipeV1 } from "../../a2a/schemas";
import type { AgeBand, Concern, I18nText, Unit } from "../../domain/common";
import type { PriceRecord } from "../../domain/platform";
import type { EffectOnset } from "../../domain/procedure";
import { getProcedure } from "../../domain/procedure-master";
import { getStore } from "../../store";
import patternsSeed from "../../../data/seed/kr-patterns.json";

type DataStatus = "demo_assumption" | "confirmed_by_planner" | "observed";

interface PatternCell {
  ageBand: AgeBand;
  concern: Concern;
  sampleSize: number;
  dataStatus: DataStatus;
  combinations: { procedureIds: string[]; share: number }[];
}

interface ConcernRankingRow {
  ageBand: AgeBand;
  dataStatus: DataStatus;
  items: { concern: Concern; label: I18nText; share: number }[];
}

interface KrPatterns {
  patterns: PatternCell[];
  concernRanking: ConcernRankingRow[];
  procedures: Record<string, { typicalAmount: { min: number; max: number; unit: Unit }; dataStatus: DataStatus }>;
}

const seed = patternsSeed as unknown as KrPatterns;

/** Below this many records the recipe says the data is thin (07 section 5). */
export const MIN_SAMPLE = 10;
/** Combinations returned (07 section 5: top 3). */
export const TOP_COMBINATIONS = 3;

// The procedure master gives onset as a bucket; the recipe wire wants days. Ranges follow the master's
// own source cells ("3~7일", "1~2주", "2~4주", "서서히(1~3개월)").
const ONSET_DAYS: Record<EffectOnset, { min: number; max: number }> = {
  instant: { min: 0, max: 0 },
  "1w": { min: 3, max: 14 },
  "2-4w": { min: 14, max: 28 },
  gradual: { min: 30, max: 90 },
};

const DISCLAIMER = {
  base: "한국 여성 시술 기록을 모은 통계예요. 시술이 맞는지, 용량과 가능 여부는 병원 의사가 판단해요.",
  thin: (n: number) => `데이터가 적어요 (표본 ${n}건). 참고로만 봐 주세요.`,
  demo: "데모용 값이에요. 실제 기록이 쌓이면 바뀌어요.",
  unknown: (ids: string[]) => `통상 용량 자료가 없는 시술은 뺐어요: ${ids.join(", ")}.`,
};

/** Typical amount from the seed, or null when the seed has none (procedure not sold by a fixed unit). */
export function seedTypicalAmount(procedureId: string): { min: number; max: number; unit: Unit } | null {
  return seed.procedures[procedureId]?.typicalAmount ?? null;
}

/** 0.5 step rounding used for typical amounts from records (07 section 1). */
const halfStep = (value: number) => Math.round(value * 2) / 2;

function quantile(sorted: number[], q: number): number {
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (position - lower);
}

/**
 * Typical amount: p25 to p75 of shared records when there are at least MIN_SAMPLE of them in the seed's unit,
 * otherwise the seed value (07 section 1 "통상 용량").
 */
export function typicalAmountFor(
  procedureId: string,
  records: readonly PriceRecord[] = [],
): { amount: { min: number; max: number; unit: Unit }; fromRecords: boolean } | null {
  const fallback = seedTypicalAmount(procedureId);
  if (!fallback) return null;
  const values = records
    .filter((r) => r.procedureId === procedureId && r.source !== "public_offer" && r.amount.unit === fallback.unit)
    .map((r) => r.amount.value)
    .sort((a, b) => a - b);
  if (values.length < MIN_SAMPLE) return { amount: fallback, fromRecords: false };
  const min = Math.max(0.5, halfStep(quantile(values, 0.25)));
  const max = Math.max(min, halfStep(quantile(values, 0.75)));
  return { amount: { min, max, unit: fallback.unit }, fromRecords: true };
}

interface MergedCombination {
  procedureIds: string[];
  count: number;
}

/** Builds the pibu/recipe@1 answer for a validated pibu/recipe-query@1. Deterministic. */
export function buildRecipe(query: RecipeQueryV1, records: readonly PriceRecord[] = []): RecipeV1 {
  const cells = seed.patterns.filter((cell) => cell.ageBand === query.ageBand && query.concerns.includes(cell.concern));
  const totalSample = cells.reduce((sum, cell) => sum + cell.sampleSize, 0);

  // Merge the same combination across concerns: counts add up, the share is over all matched records.
  const merged = new Map<string, MergedCombination>();
  for (const cell of cells) {
    for (const combination of cell.combinations) {
      const key = combination.procedureIds.join("+");
      const entry = merged.get(key) ?? { procedureIds: combination.procedureIds, count: 0 };
      entry.count += combination.share * cell.sampleSize;
      merged.set(key, entry);
    }
  }

  const requested = query.procedureIds ?? [];
  const candidates = [...merged.values()].filter(
    (c) => requested.length === 0 || c.procedureIds.some((id) => requested.includes(id)),
  );
  candidates.sort((a, b) => b.count - a.count || a.procedureIds.join("+").localeCompare(b.procedureIds.join("+")));
  const combinations = candidates.slice(0, TOP_COMBINATIONS).map((c) => ({
    procedureIds: c.procedureIds,
    share: totalSample > 0 ? Math.round((c.count / totalSample) * 100) / 100 : 0,
    sampleSize: Math.round(c.count),
  }));

  const ids = [...new Set([...requested, ...combinations.flatMap((c) => c.procedureIds)])];
  const procedures: RecipeV1["procedures"] = [];
  const unknown: string[] = [];
  let usedDemoValues = cells.some((cell) => cell.dataStatus === "demo_assumption");
  for (const id of ids) {
    const master = getProcedure(id);
    const typical = typicalAmountFor(id, records);
    if (!master || !typical) {
      unknown.push(id);
      continue;
    }
    if (!typical.fromRecords && seed.procedures[id]?.dataStatus === "demo_assumption") usedDemoValues = true;
    if (!master.verified) usedDemoValues = true;
    const initial = master.cycle.initial;
    procedures.push({
      procedureId: id,
      typicalAmount: typical.amount,
      cycle: {
        ...(initial && initial.count !== null ? { initial: { count: initial.count, intervalDays: initial.intervalDays } } : {}),
        // Series only treatments have no upkeep interval in the master; 0~0 means "no maintenance schedule".
        maintenanceIntervalDays: master.cycle.maintenanceIntervalDays ?? { min: 0, max: 0 },
      },
      downtimeDays: master.downtimeDays ?? { min: 0, max: 0 },
      onsetDays: master.effectOnset ? ONSET_DAYS[master.effectOnset] : { min: 0, max: 0 },
    });
  }

  const notes = [DISCLAIMER.base];
  if (totalSample < MIN_SAMPLE) notes.push(DISCLAIMER.thin(totalSample));
  if (usedDemoValues) notes.push(DISCLAIMER.demo);
  if (unknown.length > 0) notes.push(DISCLAIMER.unknown(unknown));

  return RecipeV1Schema.parse({
    schema: "pibu/recipe@1",
    combinations,
    procedures,
    disclaimer: notes.join(" "),
  });
}

/**
 * Share (0 to 1) of Korean women of the age band who chose the procedure, over every concern.
 * Plugs into procedure-filter's `selectionRate` context.
 */
export function selectionRate(procedureId: string, ageBand: AgeBand | undefined): number {
  const cells = seed.patterns.filter((cell) => ageBand === undefined || cell.ageBand === ageBand);
  const total = cells.reduce((sum, cell) => sum + cell.sampleSize, 0);
  if (total === 0) return 0;
  const chosen = cells.reduce(
    (sum, cell) =>
      sum +
      cell.combinations
        .filter((c) => c.procedureIds.includes(procedureId))
        .reduce((s, c) => s + c.share * cell.sampleSize, 0),
    0,
  );
  return Math.round((chosen / total) * 1000) / 1000;
}

/** Concerns Korean women of the age band report most (DEMO.md scenario 1, "고민 Top 4"). */
export function topConcerns(ageBand: AgeBand): ConcernRankingRow["items"] {
  return seed.concernRanking.find((row) => row.ageBand === ageBand)?.items ?? [];
}

async function loadRecords(): Promise<PriceRecord[]> {
  try {
    return await getStore().list<PriceRecord>("platform", "price_records");
  } catch {
    return [];
  }
}

/** Typical amount with the platform's own records, for BFF routes that may call the module directly. */
export async function platformTypicalAmount(procedureId: string): Promise<{ min: number; max: number; unit: Unit } | null> {
  return typicalAmountFor(procedureId, await loadRecords())?.amount ?? null;
}

export const recipeSkill: SkillHandler = async (data) => {
  try {
    const recipe = buildRecipe(data as RecipeQueryV1, await loadRecords());
    return { state: "TASK_STATE_COMPLETED", data: recipe };
  } catch (error) {
    return { state: "TASK_STATE_FAILED", text: `recipe failed: ${error instanceof Error ? error.message : String(error)}` };
  }
};
