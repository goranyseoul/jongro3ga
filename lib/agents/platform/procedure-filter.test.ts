import { describe, expect, it } from "vitest";
import { procedureMaster } from "../../domain/procedure-master";
import { SCORE, filterProcedures } from "./procedure-filter";

const ids = (cards: Array<{ procedure: { id: string } }>) => cards.map((c) => c.procedure.id);
const rates = (table: Record<string, number>) => (id: string) => table[id] ?? 0;
const reasonCodes = (result: ReturnType<typeof filterProcedures>, id: string) =>
  result.excluded.find((e) => e.procedure.id === id)?.reasons.map((r) => r.code).sort();

// DEMO.md scenario 1: Yuki, volume area, nasolabial fold, in Seoul 10/11 to 10/13.
describe("scenario: Yuki asks about the nasolabial fold", () => {
  const input = { areas: ["volume" as const], parts: ["nasolabial" as const], trip: { arrival: "2026-10-11", departure: "2026-10-13" } };
  const context = { selectionRate: rates({ juvelook_volume: 0.5, filler: 0.3, sculptra: 0.1 }) };

  it("shows Juvelook Volume, filler and Sculptra, the three cards of the script, Juvelook first", () => {
    const result = filterProcedures(input, context);
    expect(ids(result.ranked)).toEqual(["juvelook_volume", "filler", "sculptra"]);
    expect(result.excluded).toEqual([]);
  });

  it("explains the score: the recommended part earns full points, a merely treated part half", () => {
    const [volume, filler, sculptra] = filterProcedures(input, context).ranked;
    expect(volume!.breakdown).toEqual({ area: SCORE.area, part: SCORE.part, selection: 10, budget: SCORE.budget, pain: SCORE.pain });
    expect(filler!.breakdown.part).toBe(SCORE.part / 2);
    expect(volume!.score).toBeCloseTo(90);
    expect(filler!.score).toBeCloseTo(76);
    expect(sculptra!.score).toBeCloseTo(72);
  });

  it("warns that swelling may last past the flight, but only warns", () => {
    for (const card of filterProcedures(input, context).ranked) {
      expect(card.warnings).toContainEqual({ code: "downtime_may_overlap_departure", latestEnd: "2026-10-16", departure: "2026-10-13" });
    }
  });

  it("drops what cannot work even when treated on arrival: the boundary is the departure day itself", () => {
    const sameDay = filterProcedures({ ...input, trip: { arrival: "2026-10-11", departure: "2026-10-13" } }, context);
    expect(sameDay.ranked).toHaveLength(3);
    const oneNightShort = filterProcedures({ ...input, trip: { arrival: "2026-10-11", departure: "2026-10-12" } }, context);
    expect(oneNightShort.ranked).toEqual([]);
    expect(oneNightShort.excluded.map((e) => e.reasons[0])).toEqual([
      { code: "downtime_after_departure", earliestEnd: "2026-10-13", departure: "2026-10-12" },
      { code: "downtime_after_departure", earliestEnd: "2026-10-13", departure: "2026-10-12" },
      { code: "downtime_after_departure", earliestEnd: "2026-10-13", departure: "2026-10-12" },
    ]);
  });

  it("removes Juvelook Volume for the under eye and says why, keeping the others", () => {
    const result = filterProcedures({ areas: ["volume"], parts: ["under_eye"] }, context);
    expect(ids(result.ranked)).toEqual(["filler", "sculptra"]);
    expect(result.excluded).toHaveLength(1);
    expect(result.excluded[0]!.procedure.id).toBe("juvelook_volume");
    expect(result.excluded[0]!.reasons).toEqual([{ code: "avoid_part", part: "under_eye", reason: "결절 위험" }]);
  });
});

// DEMO.md scenario 3: Grace, lifting once a year, no downtime, no needles or threads, a week in Seoul.
describe("scenario: Grace wants lifting once a year without downtime", () => {
  const input = {
    areas: ["lifting" as const],
    maxDowntimeDays: 0,
    excludeMethods: ["injection" as const, "thread" as const],
    minMaintenanceDays: 300,
    visitGapDays: 365,
    trip: { arrival: "2026-10-20", departure: "2026-10-27" },
  };
  const context = { selectionRate: rates({ ulthera: 0.4, thermage: 0.35 }) };

  it("leaves exactly Ulthera and Thermage", () => {
    const result = filterProcedures(input, context);
    expect(ids(result.ranked)).toEqual(["ulthera", "thermage"]);
  });

  it("explains each removal so the agent can say what it left out", () => {
    const result = filterProcedures(input, context);
    expect(ids(result.excluded)).toEqual(["inmode", "oligio", "shrink", "thread_lift"]);
    expect(reasonCodes(result, "thread_lift")).toEqual(["downtime_too_long", "method_excluded"]);
    for (const id of ["inmode", "oligio", "shrink"]) expect(reasonCodes(result, id), id).toEqual(["cycle_too_frequent"]);
  });

  it("flags pain above the visitor's limit without removing the treatment, and ranks it lower", () => {
    const strict = filterProcedures({ ...input, maxPain: "mid" }, context);
    expect(ids(strict.ranked)).toEqual(["ulthera", "thermage"]);
    for (const card of strict.ranked) {
      expect(card.warnings).toContainEqual({ code: "pain_above_preference", pain: "high" });
      expect(card.breakdown.pain).toBe(0);
    }
  });

  it("one visit a year needs a long lasting effect even when downtime is fine", () => {
    const result = filterProcedures({ areas: ["lifting"], minMaintenanceDays: 300 }, {});
    expect(ids(result.ranked)).toEqual(["thermage", "thread_lift", "ulthera"]);
  });
});

// DEMO.md scenario 4: Lin visits every four months, Rejuran needs three visits a month apart.
describe("scenario: Lin cannot repeat a monthly series", () => {
  it("detects the mismatch for Rejuran and keeps what fits a four month rhythm", () => {
    const result = filterProcedures({ areas: ["texture_renewal"], visitGapDays: 120 }, {});
    for (const id of ["rejuran", "juvelook", "juvelook_eye", "skin_booster", "exosome", "fraxel"]) {
      expect(reasonCodes(result, id), id).toEqual(["series_too_close"]);
    }
    expect(ids(result.ranked)).toEqual(expect.arrayContaining(["thermage", "skin_botox", "lituo"]));
    expect(ids(result.ranked)).not.toContain("rejuran");
  });

  it("the same visitor is fine with the series when visits are a month apart", () => {
    const result = filterProcedures({ areas: ["texture_renewal"], visitGapDays: 30 }, {});
    expect(ids(result.ranked)).toContain("rejuran");
  });
});

describe("conditions", () => {
  it("only lists procedures of the requested areas and scores a partial area match proportionally", () => {
    const result = filterProcedures({ areas: ["lifting", "volume"] }, {});
    const ulthera = result.ranked.find((c) => c.procedure.id === "ulthera")!;
    const filler = result.ranked.find((c) => c.procedure.id === "filler")!;
    expect(ulthera.breakdown.area).toBe(SCORE.area / 2);
    expect(filler.breakdown.area).toBe(SCORE.area / 2);
    const thermage = result.ranked.find((c) => c.procedure.id === "thermage")!;
    expect(thermage.procedure.areas).toContain("lifting");
    expect(ids(result.ranked)).not.toContain("botox_wrinkle");
  });

  it("filters by method when the visitor knows it, and by excluded methods", () => {
    const only = filterProcedures({ areas: ["lifting"], methods: ["hifu"] }, {});
    expect(ids(only.ranked)).toEqual(["shrink", "ulthera"]);
    expect(reasonCodes(only, "thermage")).toEqual(["method_not_selected"]);
    const excludingRf = filterProcedures({ areas: ["lifting"], excludeMethods: ["rf"] }, {});
    expect(ids(excludingRf.excluded)).toEqual(["inmode", "oligio", "thermage"]);
  });

  it("downtime limits use the upper end of the range: three days OK means a 1~3 day treatment passes, 2~5 does not", () => {
    const result = filterProcedures({ areas: ["texture_renewal", "volume"], maxDowntimeDays: 3 }, {});
    expect(ids(result.ranked)).toContain("rejuran");
    expect(reasonCodes(result, "filler")).toEqual(["downtime_too_long"]);
  });

  it("budget: fully inside earns full points, partly inside half, above nothing plus a warning", () => {
    const result = filterProcedures({ areas: ["lifting"], budgetKrw: 1_500_000 }, {});
    const byId = Object.fromEntries(result.ranked.map((c) => [c.procedure.id, c]));
    expect(byId.shrink!.breakdown.budget).toBe(SCORE.budget);
    expect(byId.ulthera!.breakdown.budget).toBe(SCORE.budget / 2);
    const tight = filterProcedures({ areas: ["lifting"], budgetKrw: 400_000 }, {});
    const ulthera = tight.ranked.find((c) => c.procedure.id === "ulthera")!;
    expect(ulthera.breakdown.budget).toBe(0);
    expect(ulthera.warnings).toContainEqual({ code: "over_budget" });
  });

  it("unknown data never removes a treatment: it warns and earns no points", () => {
    const result = filterProcedures(
      { areas: ["texture_renewal"], maxDowntimeDays: 0, budgetKrw: 300_000, trip: { arrival: "2026-10-20", departure: "2026-10-27" } },
      {},
    );
    const lituo = result.ranked.find((c) => c.procedure.id === "lituo")!;
    expect(lituo.warnings).toEqual(expect.arrayContaining([{ code: "downtime_unknown" }, { code: "price_unknown" }]));
    expect(lituo.breakdown.budget).toBe(0);
  });

  it("orders by score, then selection rate, then id, whatever the input order", () => {
    const base = procedureMaster.find((p) => p.id === "botox_wrinkle")!;
    const copies = ["zeta", "alpha", "mid"].map((id) => ({ ...base, id }));
    const tied = filterProcedures({ areas: ["wrinkles"] }, { procedures: copies });
    expect(ids(tied.ranked)).toEqual(["alpha", "mid", "zeta"]);
    const byRate = filterProcedures({ areas: ["wrinkles"] }, { procedures: copies, selectionRate: rates({ zeta: 0.2, mid: 0.2 }) });
    expect(ids(byRate.ranked)).toEqual(["mid", "zeta", "alpha"]);
    const reversed = filterProcedures({ areas: ["wrinkles"] }, { procedures: [...copies].reverse() });
    expect(ids(reversed.ranked)).toEqual(["alpha", "mid", "zeta"]);
  });

  it("clamps selection rates to 0..1", () => {
    const high = filterProcedures({ areas: ["lifting"] }, { selectionRate: () => 5 });
    const low = filterProcedures({ areas: ["lifting"] }, { selectionRate: () => -1 });
    expect(high.ranked[0]!.breakdown.selection).toBe(SCORE.selection);
    expect(low.ranked[0]!.breakdown.selection).toBe(0);
  });

  it("passes the age band to the selection rate lookup and is repeatable", () => {
    const seen: Array<string | undefined> = [];
    const input = { areas: ["lifting" as const], ageBand: "40+" as const };
    const first = filterProcedures(input, { selectionRate: (_id, age) => (seen.push(age), 0.1) });
    expect(new Set(seen)).toEqual(new Set(["40+"]));
    expect(filterProcedures(input, { selectionRate: () => 0.1 })).toEqual(first);
  });

  it("rejects an empty area list and a trip that ends before it starts", () => {
    expect(() => filterProcedures({ areas: [] })).toThrow(TypeError);
    expect(() => filterProcedures({ areas: ["lifting"], trip: { arrival: "2026-10-13", departure: "2026-10-11" } })).toThrow(TypeError);
  });
});
