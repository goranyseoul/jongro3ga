import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PIBU_SCHEMAS } from "../../a2a/schemas";
import { setupPlatformTest, teardownPlatformTest } from "./__fixtures__/offer-cache";
import { RECIPE_DISCLAIMER, recipe } from "./recipe";

beforeEach(setupPlatformTest);
afterEach(teardownPlatformTest);

describe("platform.recipe", () => {
  it("returns the top three combinations of the age band and concern by share, with procedure facts", async () => {
    const result = await recipe({ schema: "pibu/recipe-query@1", concerns: ["elasticity"], ageBand: "25-29" });
    expect(PIBU_SCHEMAS["pibu/recipe@1"].safeParse(result).success).toBe(true);
    expect(result.combinations).toEqual([
      { procedureIds: ["rejuran_healer"], share: 0.41, sampleSize: 87 },
      { procedureIds: ["rejuran_healer", "shrink_universe"], share: 0.22, sampleSize: 87 },
      { procedureIds: ["skin_booster_juvelook"], share: 0.14, sampleSize: 87 },
    ]);
    expect(result.procedures.map((p) => p.procedureId)).toEqual(["rejuran_healer", "shrink_universe", "skin_booster_juvelook"]);
    expect(result.procedures[0]).toEqual({
      procedureId: "rejuran_healer",
      typicalAmount: { min: 2, max: 3, unit: "cc" },
      cycle: { initial: { count: 3, intervalDays: 30 }, maintenanceIntervalDays: { min: 90, max: 120 } },
      downtimeDays: { min: 1, max: 3 },
      onsetDays: { min: 14, max: 28 },
    });
    expect(result.disclaimer).toContain(RECIPE_DISCLAIMER.demoValues);
    expect(result.disclaimer).not.toContain(RECIPE_DISCLAIMER.smallSample);
  });

  it("says the data is thin below 10 records", async () => {
    const result = await recipe({ schema: "pibu/recipe-query@1", concerns: ["fine_lines"], ageBand: "40+" });
    expect(result.combinations).toEqual([{ procedureIds: ["botox_forehead"], share: 0.4, sampleSize: 8 }]);
    expect(result.disclaimer).toContain(RECIPE_DISCLAIMER.smallSample);
  });

  it("matches any shared concern, narrows to the candidate procedures, and gives no medical advice", async () => {
    const both = await recipe({ schema: "pibu/recipe-query@1", concerns: ["elasticity", "fine_lines"], ageBand: "30-34" });
    expect(both.combinations.map((c) => c.share)).toEqual([0.35, 0.33, 0.3]);
    const narrowed = await recipe({ schema: "pibu/recipe-query@1", concerns: ["elasticity"], ageBand: "30-34", procedureIds: ["thermage_flx"] });
    expect(narrowed.combinations).toEqual([{ procedureIds: ["thermage_flx"], share: 0.16, sampleSize: 96 }]);
    for (const r of [both, narrowed]) expect(r.disclaimer).not.toMatch(/받으세요|추천해요|recommend|おすすめ/);
  });

  it("returns no combination and the thin data note when nothing matches", async () => {
    const none = await recipe({ schema: "pibu/recipe-query@1", concerns: ["redness"], ageBand: "20-24" });
    expect(none.combinations).toEqual([]);
    expect(none.procedures).toEqual([]);
    expect(none.disclaimer).toContain(RECIPE_DISCLAIMER.smallSample);
  });
});
