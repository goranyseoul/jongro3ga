import type { RecipeQueryV1, RecipeV1 } from "../../a2a/schemas";
import type { KrPattern } from "../../store/seed-schemas";
import { procedureFacts } from "./procedure-facts";
import { platformStore } from "./store";

// platform.recipe (07 5절): what Korean women of the same age band with the same concerns actually chose, with
// the typical dose, cycle, downtime and onset of each procedure. Data citation only, no medical advice (08 6절).

export const MAX_COMBINATIONS = 3;
export const SMALL_SAMPLE = 10;

export const RECIPE_DISCLAIMER = {
  base: "한국 여성 시술 기록에서 나온 참고 정보예요. 시술 여부와 용량은 의사가 정해요.",
  smallSample: "데이터가 적어요",
  demoValues: "데모용 값",
} as const;

/** Patterns of the age band sharing a concern with the query, by share (then id), at most three. Pure. */
export function topCombinations(patterns: readonly KrPattern[], query: RecipeQueryV1): KrPattern[] {
  return patterns
    .filter((p) => p.ageBand === query.ageBand && p.concerns.some((c) => query.concerns.includes(c)))
    .filter((p) => !query.procedureIds || p.procedureIds.some((id) => query.procedureIds!.includes(id)))
    .sort((a, b) => b.share - a.share || a.id.localeCompare(b.id))
    .slice(0, MAX_COMBINATIONS);
}

/** The pibu/recipe@1 for a query over the given patterns. Pure. */
export function buildRecipe(patterns: readonly KrPattern[], query: RecipeQueryV1): RecipeV1 {
  const combos = topCombinations(patterns, query);
  const procedureIds = [...new Set(combos.flatMap((c) => c.procedureIds))];
  const procedures: RecipeV1["procedures"] = [];
  let demo = combos.some((c) => c.dataStatus === "demo_assumption");
  for (const id of procedureIds) {
    const facts = procedureFacts(id);
    // A procedure without a dose, unit, downtime, onset or cycle in the master cannot be described: left out.
    if (!facts?.unit || !facts.typicalAmount || !facts.downtimeDays || !facts.onsetDays || !facts.cycle.maintenanceIntervalDays) continue;
    if (facts.dataStatus === "demo_assumption") demo = true;
    procedures.push({
      procedureId: id,
      typicalAmount: { ...facts.typicalAmount, unit: facts.unit },
      cycle: {
        ...(facts.cycle.initial ? { initial: facts.cycle.initial } : {}),
        maintenanceIntervalDays: facts.cycle.maintenanceIntervalDays,
      },
      downtimeDays: facts.downtimeDays,
      onsetDays: facts.onsetDays,
    });
  }
  const notes: string[] = [RECIPE_DISCLAIMER.base];
  if (combos.length === 0 || combos.some((c) => c.sampleSize < SMALL_SAMPLE)) notes.push(RECIPE_DISCLAIMER.smallSample);
  if (demo) notes.push(RECIPE_DISCLAIMER.demoValues);
  return {
    schema: "pibu/recipe@1",
    combinations: combos.map((c) => ({ procedureIds: c.procedureIds, share: c.share, sampleSize: c.sampleSize })),
    procedures,
    disclaimer: notes.join(" · "),
  };
}

export async function recipe(query: RecipeQueryV1): Promise<RecipeV1> {
  return buildRecipe(await platformStore.krPatterns(), query);
}
