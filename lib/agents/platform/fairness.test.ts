import { describe, expect, it } from "vitest";
import seedOutcomes from "../../../data/seed/outcomes.json";
import seedRecords from "../../../data/seed/price-records.json";
import type { Outcome, PriceRecord } from "../../domain";
import { FairnessVerdictV1Schema } from "../../a2a/schemas";
import {
  buildSample,
  clinicFlagsFor,
  judgeQuote,
  normalizeQuote,
  verdictFromSample,
  type JudgeQuoteInput,
  type PriceSample,
} from "./fairness";
import { explainVerdict, PAID_MORE_WARNING } from "./fairness-copy";

// 07 "기준 테스트 케이스": a fixed reference sample, rejuran gangnam_sinsa.
const SAMPLE: Omit<PriceSample, "records" | "outliers" | "region"> = {
  n: 42,
  p25: 140000,
  p50: 160000,
  p75: 185000,
  p90: 210000,
  typicalAmount: { min: 2, max: 3, unit: "cc" },
};

const quote = (quoteId: string, clinicId: string, value: number, priceKrw: number, vatIncluded: boolean): JudgeQuoteInput => ({
  quoteId,
  clinicId,
  procedureId: "rejuran_healer",
  amount: { value, unit: "cc" },
  priceKrw,
  vatIncluded,
  includes: [],
});

const INDICATIVE = { code: "indicative_price" } as const;

describe("07 reference table", () => {
  const rows = [
    { name: "Mint", q: quote("qt_mint", "cln_mint", 1, 99000, true), flags: [INDICATIVE], unit: 99000, band: "low", dose: "below_typical", label: "underdosed" },
    { name: "Seoul Glow", q: quote("qt_glow", "cln_seoul_glow", 2, 340000, true), flags: [], unit: 170000, band: "mid", dose: "within", label: "fair" },
    {
      name: "Ara",
      q: quote("qt_ara", "cln_ara", 2, 300000, false),
      flags: [{ code: "paid_more_than_quoted", avgGapPct: 15 } as const, INDICATIVE],
      unit: 165000,
      band: "mid",
      dose: "within",
      label: "fair",
    },
    { name: "Hanbit", q: quote("qt_hanbit", "cln_hanbit", 2, 420000, true), flags: [INDICATIVE], unit: 210000, band: "high", dose: "within", label: "high" },
  ] as const;

  for (const row of rows) {
    it(`${row.name}: ${row.label}`, () => {
      const v = verdictFromSample(row.q, SAMPLE, [...row.flags]);
      expect(FairnessVerdictV1Schema.safeParse(v).success).toBe(true);
      expect(v.normalizedUnitKrw).toBe(row.unit);
      expect(v.priceBand).toBe(row.band);
      expect(v.doseFlag).toBe(row.dose);
      expect(v.label).toBe(row.label);
      expect(v.clinicFlags).toEqual(row.flags);
      expect(v.confidence).toBe("high");
      expect(v.sampleSize).toBe(42);
      expect(v.typicalAmount).toEqual({ min: 2, max: 3, unit: "cc" });
    });
  }

  it("Ara's explanation carries the paid-more warning, Seoul Glow's does not", () => {
    const ara = verdictFromSample(rows[2].q, SAMPLE, [...rows[2].flags]);
    expect(ara.explanation.ja).toContain("見積もりより支払額が高かった記録があります");
    expect(ara.explanation.ko).toContain(PAID_MORE_WARNING.ko);
    const glow = verdictFromSample(rows[1].q, SAMPLE, []);
    expect(glow.explanation.ja).not.toContain(PAID_MORE_WARNING.ja);
  });
});

describe("07 boundary values", () => {
  it("x = p75 exactly is mid", () => {
    expect(verdictFromSample(quote("qt_b1", "cln_seoul_glow", 2, 370000, true), SAMPLE, []).priceBand).toBe("mid");
  });
  it("x = p90 exactly is high", () => {
    expect(verdictFromSample(quote("qt_b2", "cln_seoul_glow", 2, 420000, true), SAMPLE, []).priceBand).toBe("high");
  });
  it("one won above p75 is high, one won above p90 is very_high, one below p25 is low", () => {
    expect(verdictFromSample(quote("qt_b3", "cln_seoul_glow", 1, 185001, true), SAMPLE, []).priceBand).toBe("high");
    expect(verdictFromSample(quote("qt_b4", "cln_seoul_glow", 2, 420002, true), SAMPLE, []).label).toBe("very_high");
    expect(verdictFromSample(quote("qt_b5", "cln_seoul_glow", 2, 279998, true), SAMPLE, []).label).toBe("good_deal");
    expect(verdictFromSample(quote("qt_b6", "cln_seoul_glow", 2, 280000, true), SAMPLE, []).label).toBe("fair");
  });
  it("n = 4 is insufficient_data with confidence none, n = 5 is judged with confidence low", () => {
    const four = verdictFromSample(quote("qt_b7", "cln_seoul_glow", 2, 340000, true), { ...SAMPLE, n: 4 }, []);
    expect(four.label).toBe("insufficient_data");
    expect(four.priceBand).toBe("insufficient");
    expect(four.confidence).toBe("none");
    const five = verdictFromSample(quote("qt_b8", "cln_seoul_glow", 2, 340000, true), { ...SAMPLE, n: 5 }, []);
    expect(five.label).toBe("fair");
    expect(five.confidence).toBe("low");
  });
  it("underdosed wins over insufficient data; above 1.5 x max is above_typical", () => {
    expect(verdictFromSample(quote("qt_b9", "cln_mint", 1, 99000, true), { ...SAMPLE, n: 3 }, []).label).toBe("underdosed");
    expect(verdictFromSample(quote("qt_b10", "cln_mint", 4.5, 765000, true), SAMPLE, []).doseFlag).toBe("within");
    expect(verdictFromSample(quote("qt_b11", "cln_mint", 5, 850000, true), SAMPLE, []).doseFlag).toBe("above_typical");
  });
  it("confidence bands 30 / 10 / 5", () => {
    const at = (n: number) => verdictFromSample(quote("qt_c", "cln_seoul_glow", 2, 340000, true), { ...SAMPLE, n }, []).confidence;
    expect([at(30), at(29), at(10), at(9), at(5)]).toEqual(["high", "medium", "medium", "low", "low"]);
  });
  it("VAT excluded prices are normalized with 10% and rounded", () => {
    expect(normalizeQuote({ priceKrw: 300000, vatIncluded: false, amount: { value: 2, unit: "cc" } })).toEqual({ totalKrw: 330000, unitKrw: 165000 });
    expect(normalizeQuote({ priceKrw: 99999, vatIncluded: false, amount: { value: 3, unit: "cc" } })).toEqual({ totalKrw: 109999, unitKrw: 36666 });
  });
});

describe("reference sample from the seed", () => {
  const records = seedRecords as unknown as PriceRecord[];
  for (const today of ["2026-10-24", "2026-11-12"]) {
    it(`rejuran gangnam_sinsa at ${today}: n = 42 with the 07 quantiles and 2~3cc`, () => {
      const s = buildSample(records, { procedureId: "rejuran_healer", area: "sinsa", today });
      expect(s.region).toBe("gangnam_sinsa");
      expect(s.n).toBe(42);
      expect([s.p25, s.p50, s.p75, s.p90]).toEqual([140000, 160000, 185000, 210000]);
      expect(s.typicalAmount).toEqual({ min: 2, max: 3, unit: "cc" });
      expect(s.outliers).toHaveLength(0);
    });
  }

  it("falls back to all of Seoul when the region has fewer than 5 records", () => {
    const few = records.filter((r) => r.procedureId === "rejuran_healer" && r.area !== "hongdae").concat(
      records.filter((r) => r.procedureId === "rejuran_healer" && r.area === "hongdae").slice(0, 3),
    );
    const s = buildSample(few, { procedureId: "rejuran_healer", area: "hongdae", today: "2026-10-24" });
    expect(s.region).toBe("seoul");
    expect(s.n).toBeGreaterThan(42);
  });

  it("drops outliers beyond 3 IQR", () => {
    const base = records.filter((r) => r.procedureId === "rejuran_healer" && ["sinsa", "gangnam", "apgujeong"].includes(r.area));
    const outlier: PriceRecord = { ...base[0], id: "pr_outlier", normalizedUnitKrw: 900000, paidKrw: 1800000, date: "2026-10-01", verified: true, source: "shared_record" };
    const s = buildSample([...base, outlier], { procedureId: "rejuran_healer", area: "gangnam", today: "2026-10-24" });
    expect(s.outliers.map((r) => r.id)).toEqual(["pr_outlier"]);
    expect(s.n).toBe(42);
  });

  it("clinic flags from seed outcomes: Ara paid_more_than_quoted +15%, the others none", () => {
    const outcomes = seedOutcomes as unknown as Outcome[];
    const of = (id: string) => outcomes.filter((o) => o.clinicId === id);
    expect(clinicFlagsFor({ outcomes: of("cln_ara"), today: "2026-10-24", operationMode: "proxy" })).toEqual([
      { code: "paid_more_than_quoted", avgGapPct: 15 },
      INDICATIVE,
    ]);
    expect(clinicFlagsFor({ outcomes: of("cln_ara"), today: "2026-11-12", operationMode: "proxy" })[0]).toMatchObject({ code: "paid_more_than_quoted" });
    expect(clinicFlagsFor({ outcomes: of("cln_seoul_glow"), today: "2026-10-24", operationMode: "clinic" })).toEqual([]);
    expect(clinicFlagsFor({ outcomes: of("cln_mint"), today: "2026-10-24", operationMode: "proxy" })).toEqual([INDICATIVE]);
  });

  it("judgeQuote end to end reproduces the table from seed data", () => {
    const outcomes = seedOutcomes as unknown as Outcome[];
    const run = (q: JudgeQuoteInput, area: "sinsa" | "gangnam" | "apgujeong" | "myeongdong", mode: "proxy" | "clinic") =>
      judgeQuote({ quote: q, records, clinic: { area, operationMode: mode, outcomes: outcomes.filter((o) => o.clinicId === q.clinicId) }, today: "2026-10-24" }).verdict.label;
    expect(run(quote("qt_1", "cln_mint", 1, 99000, true), "gangnam", "proxy")).toBe("underdosed");
    expect(run(quote("qt_2", "cln_seoul_glow", 2, 340000, true), "sinsa", "clinic")).toBe("fair");
    expect(run(quote("qt_3", "cln_ara", 2, 300000, false), "apgujeong", "proxy")).toBe("fair");
  });
});

describe("fairness copy", () => {
  const DASHES = [String.fromCodePoint(0x2014), String.fromCodePoint(0x2013)];
  const BANNED = ["より良い", "better than", "보다 낫", "比其他"];
  const labels = ["fair", "good_deal", "high", "very_high", "underdosed", "insufficient_data"] as const;

  it("has all four languages for every label, no clinic comparisons, no dashes", () => {
    for (const label of labels) {
      const text = explainVerdict({
        label,
        amountValue: 2,
        unit: "cc",
        typicalMin: 2,
        typicalMax: 3,
        unitKrw: 170000,
        sampleSize: 42,
        p25: 140000,
        p75: 185000,
        p90: 210000,
        paidMoreThanQuotedPct: 15,
        indicative: true,
      });
      expect(Object.keys(text).sort()).toEqual(["en", "ja", "ko", "zh-CN"]);
      for (const sentence of Object.values(text)) {
        expect(sentence.length).toBeGreaterThan(10);
        for (const word of [...BANNED, ...DASHES]) expect(sentence).not.toContain(word);
      }
    }
  });
});
