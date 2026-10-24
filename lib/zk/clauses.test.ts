import { describe, expect, it } from "vitest";
import type { ZkChart } from "../domain/zk";
import { FOREVER, clauseHolds, describeClause, firstVisit, loyal, nthSession, offerEligible, toCircuitClause } from "./clauses";

const empty = (): ZkChart => ({ types: Array(8).fill(0), dates: Array(8).fill(0), clinics: Array(8).fill(0), salt: "1" });

// One rejuran (code 1) at Hanbit (code 3) on day 1000.
const oneRejuran = (): ZkChart => {
  const chart = empty();
  chart.types[0] = 1;
  chart.dates[0] = 1000;
  chart.clinics[0] = 3;
  return chart;
};

const TODAY = 1010;

describe("clauseHolds", () => {
  it("one rejuran at Hanbit", () => {
    const chart = oneRejuran();
    expect(clauseHolds(chart, TODAY, firstVisit("cln_mint"))).toBe(true);
    expect(clauseHolds(chart, TODAY, firstVisit("cln_hanbit"))).toBe(false);
    expect(clauseHolds(chart, TODAY, { type: "rejuran_healer", minCount: 1, maxCount: 1 })).toBe(true);
    expect(clauseHolds(chart, TODAY, { type: "rejuran_healer", clinicId: "cln_hanbit", minCount: 1, maxCount: 1 })).toBe(true);
    expect(clauseHolds(chart, TODAY, { type: "rejuran_healer", clinicId: "cln_mint", minCount: 1, maxCount: 1 })).toBe(false);
    expect(clauseHolds(chart, TODAY, loyal("rejuran_healer", 3))).toBe(false);
    expect(clauseHolds(chart, TODAY, nthSession("rejuran_healer", 2))).toBe(true);
    expect(clauseHolds(chart, TODAY, nthSession("ulthera", 1))).toBe(true);
  });

  it("empty chart: every first visit holds, a second session does not", () => {
    const chart = empty();
    for (const clinic of ["cln_seoul_glow", "cln_mint", "cln_hanbit", "cln_ara", "cln_dahye"]) {
      expect(clauseHolds(chart, TODAY, firstVisit(clinic))).toBe(true);
    }
    expect(clauseHolds(chart, TODAY, nthSession("rejuran_healer", 2))).toBe(false);
    expect(clauseHolds(chart, TODAY, nthSession("rejuran_healer", 1))).toBe(true);
  });

  it("a record with type 0 never counts, even when the clause matches any procedure", () => {
    const chart = empty();
    chart.dates[0] = 1000;
    expect(clauseHolds(chart, TODAY, { minCount: 1 })).toBe(false);
    expect(clauseHolds(chart, TODAY, { maxCount: 0 })).toBe(true);
  });

  it("applies the day window: minDays..maxDays before today", () => {
    const chart = oneRejuran(); // 10 days old at TODAY
    expect(clauseHolds(chart, TODAY, { type: "rejuran_healer", maxDays: 30, minCount: 1 })).toBe(true);
    expect(clauseHolds(chart, TODAY, { type: "rejuran_healer", maxDays: 9, minCount: 1 })).toBe(false);
    expect(clauseHolds(chart, TODAY, { type: "rejuran_healer", maxDays: 9, maxCount: 0 })).toBe(true);
    expect(clauseHolds(chart, TODAY, { type: "rejuran_healer", minDays: 10, minCount: 1 })).toBe(true);
    expect(clauseHolds(chart, TODAY, { type: "rejuran_healer", minDays: 11, minCount: 1 })).toBe(false);
    expect(clauseHolds(chart, TODAY, { type: "rejuran_healer", minDays: 5, maxDays: 10, minCount: 1, maxCount: 1 })).toBe(true);
  });

  it("offerEligible needs every clause", () => {
    const chart = oneRejuran();
    expect(offerEligible(chart, TODAY, [firstVisit("cln_mint"), nthSession("rejuran_healer", 2)])).toBe(true);
    expect(offerEligible(chart, TODAY, [firstVisit("cln_mint"), firstVisit("cln_hanbit")])).toBe(false);
    expect(offerEligible(chart, TODAY, [])).toBe(true);
  });
});

describe("presets and circuit mapping", () => {
  it("produce the documented shapes", () => {
    expect(firstVisit("cln_mint")).toEqual({ clinicId: "cln_mint", maxCount: 0 });
    expect(nthSession("rejuran_healer", 2)).toEqual({ type: "rejuran_healer", minCount: 1, maxCount: 1 });
    expect(loyal("rejuran_healer", 3)).toEqual({ type: "rejuran_healer", minCount: 3 });
  });

  it("toCircuitClause maps ids to codes and fills defaults", () => {
    expect(toCircuitClause(firstVisit("cln_mint"))).toEqual({
      target_type: 0,
      target_clinic: 2,
      min_days: 0,
      max_days: FOREVER,
      min_count: 0,
      max_count: 0,
    });
    expect(toCircuitClause({ type: "rejuran_healer", clinicId: "cln_hanbit", minDays: 1, maxDays: 30, minCount: 1 })).toEqual({
      target_type: 1,
      target_clinic: 3,
      min_days: 1,
      max_days: 30,
      min_count: 1,
      max_count: 8,
    });
    expect(() => toCircuitClause({ type: "nope", maxCount: 0 })).toThrow();
  });

  it("describeClause returns structured descriptors", () => {
    expect(describeClause(firstVisit("cln_mint"))).toEqual({ kind: "first_visit", clinicId: "cln_mint" });
    expect(describeClause({ clinicId: "cln_mint", maxDays: 90, maxCount: 0 })).toEqual({
      kind: "none_within",
      clinicId: "cln_mint",
      maxDays: 90,
    });
    expect(describeClause(nthSession("rejuran_healer", 2))).toEqual({ kind: "exact_count", procedureId: "rejuran_healer", count: 1 });
    expect(describeClause(loyal("rejuran_healer", 3))).toEqual({ kind: "min_count", procedureId: "rejuran_healer", minCount: 3 });
    expect(describeClause({ maxCount: 2 })).toEqual({ kind: "max_count", maxCount: 2 });
    expect(describeClause({ minCount: 1, maxCount: 3 })).toEqual({ kind: "range", minCount: 1, maxCount: 3 });
  });
});
