import { describe, expect, it } from "vitest";
import { RecipeV1Schema } from "../../a2a/schemas";
import type { PriceRecord } from "../../domain/platform";
import { findMedicalViolations } from "../../llm/guard";
import { buildRecipe, recipeSkill, selectionRate, topConcerns, typicalAmountFor } from "./recipe";

const query = (concerns: string[], ageBand: string, procedureIds?: string[]) =>
  ({ schema: "pibu/recipe-query@1", concerns, ageBand, ...(procedureIds ? { procedureIds } : {}) }) as Parameters<
    typeof buildRecipe
  >[0];

describe("platform.recipe", () => {
  it("returns a valid pibu/recipe@1 with the top 3 combinations for Yuki's age band and concern", () => {
    const recipe = buildRecipe(query(["elasticity"], "25-29"));
    expect(RecipeV1Schema.safeParse(recipe).success).toBe(true);
    expect(recipe.combinations).toHaveLength(3);
    expect(recipe.combinations[0]).toEqual({ procedureIds: ["rejuran"], share: 0.41, sampleSize: 19 });
    expect(recipe.combinations.map((c) => c.share)).toEqual([...recipe.combinations.map((c) => c.share)].sort((a, b) => b - a));
  });

  it("gives Rejuran the 2~3cc typical amount, the monthly series of three and the master's downtime", () => {
    const recipe = buildRecipe(query(["elasticity"], "25-29", ["rejuran"]));
    const rejuran = recipe.procedures.find((p) => p.procedureId === "rejuran")!;
    expect(rejuran).toEqual({
      procedureId: "rejuran",
      typicalAmount: { min: 2, max: 3, unit: "cc" },
      cycle: { initial: { count: 3, intervalDays: 30 }, maintenanceIntervalDays: { min: 90, max: 120 } },
      downtimeDays: { min: 1, max: 3 },
      onsetDays: { min: 14, max: 28 },
    });
    // procedureIds filter: every combination includes the requested procedure
    expect(recipe.combinations.every((c) => c.procedureIds.includes("rejuran"))).toBe(true);
  });

  it("puts Juvelook Volume first for smile lines in the late 20s and early 30s (DEMO.md scenario 1)", () => {
    expect(buildRecipe(query(["fine_lines"], "25-29")).combinations[0]!.procedureIds).toEqual(["juvelook_volume"]);
    expect(buildRecipe(query(["fine_lines"], "30-34")).combinations[0]!.procedureIds).toEqual(["juvelook_volume"]);
  });

  it("shows Ulthera and Thermage for women over 40 with sagging (DEMO.md scenario 3)", () => {
    const top = buildRecipe(query(["elasticity"], "40+")).combinations.map((c) => c.procedureIds.join("+"));
    expect(top).toEqual(["ulthera", "thermage", "ulthera+thermage"]);
  });

  it("merges concerns: shares are over all matched records and still sorted", () => {
    const recipe = buildRecipe(query(["elasticity", "dryness"], "25-29"));
    expect(recipe.combinations[0]!.procedureIds).toEqual(["rejuran"]);
    // rejuran: 0.41 * 46 + 0.30 * 33 = 28.76 of 79
    expect(recipe.combinations[0]).toEqual({ procedureIds: ["rejuran"], share: 0.36, sampleSize: 29 });
  });

  it("always carries the base disclaimer and the demo value note", () => {
    const { disclaimer } = buildRecipe(query(["elasticity"], "25-29"));
    expect(disclaimer).toContain("의사가 판단해요");
    expect(disclaimer).toContain("데모용 값");
    expect(disclaimer).not.toContain("데이터가 적어요");
  });

  it("says the data is thin when the sample is under 10", () => {
    const { disclaimer } = buildRecipe(query(["pores"], "40+"));
    expect(disclaimer).toContain("데이터가 적어요 (표본 9건)");
  });

  it("drops procedures without a typical amount and says so", () => {
    const recipe = buildRecipe(query(["pores"], "25-29", ["lituo"]));
    expect(recipe.procedures.map((p) => p.procedureId)).not.toContain("lituo");
    expect(recipe.disclaimer).toContain("lituo");
  });

  it("has no medical advice wording in any disclaimer", () => {
    for (const ageBand of ["20-24", "25-29", "30-34", "35-39", "40+"]) {
      for (const concern of ["elasticity", "fine_lines", "pores", "acne_scars", "pigmentation", "redness", "dryness", "contour"]) {
        const recipe = buildRecipe(query([concern], ageBand));
        expect(findMedicalViolations(recipe.disclaimer)).toEqual([]);
        expect(RecipeV1Schema.safeParse(recipe).success).toBe(true);
      }
    }
  });

  it("uses shared records for the typical amount once there are at least 10 (p25~p75, 0.5 steps)", () => {
    const records = Array.from({ length: 12 }, (_, i): PriceRecord => ({
      id: `pr_${i}`,
      procedureId: "rejuran",
      area: "gangnam",
      amount: { value: i < 6 ? 2 : 4, unit: "cc" },
      paidKrw: 300000,
      normalizedUnitKrw: 150000,
      source: "shared_record",
      verified: true,
      date: "2026-10-01",
    }));
    expect(typicalAmountFor("rejuran", records)).toEqual({ amount: { min: 2, max: 4, unit: "cc" }, fromRecords: true });
    expect(typicalAmountFor("rejuran", records.slice(0, 9))).toEqual({ amount: { min: 2, max: 3, unit: "cc" }, fromRecords: false });
  });

  it("exposes the selection rate for the procedure filter and the concern ranking for the opener", () => {
    expect(selectionRate("rejuran", "25-29")).toBeGreaterThan(selectionRate("ulthera", "25-29"));
    expect(topConcerns("25-29").map((c) => c.label.ko)).toEqual([
      "팔자 주름이 파여 보임",
      "피부결이 거칠어짐",
      "턱선 탄력이 떨어짐",
      "눈가 잔주름",
    ]);
  });

  it("answers the A2A skill with a completed task", async () => {
    const result = await recipeSkill(query(["elasticity"], "35-39") as unknown as Record<string, unknown>, {
      caller: { role: "customer", agentId: "cag_7f3k2" },
      self: { role: "platform", agentId: "platform" },
      taskId: "t1",
      contextId: "req_1",
      metadata: {},
    });
    expect(result.state).toBe("TASK_STATE_COMPLETED");
    expect((result.data as { schema: string }).schema).toBe("pibu/recipe@1");
  });
});
