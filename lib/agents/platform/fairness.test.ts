import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PIBU_SCHEMAS } from "../../a2a/schemas";
import { clock } from "../../clock";
import type { Outcome, PriceRecord } from "../../domain";
import { setupPlatformTest, teardownPlatformTest } from "./__fixtures__/offer-cache";
import {
  buildReference,
  clinicFlagsFor,
  judgeQuote,
  judgeQuotes,
  referenceFor,
  selectReferenceSample,
  type PriceReference,
} from "./fairness";
import { platformStore } from "./store";

// 07 1절 기준 표본: rejuran gangnam_sinsa, n = 42, p25 140,000 · p50 160,000 · p75 185,000 · p90 210,000, 2~3cc.
const REFERENCE: PriceReference = {
  region: "gangnam_sinsa",
  n: 42,
  p25: 140_000,
  p50: 160_000,
  p75: 185_000,
  p90: 210_000,
  typicalAmount: { min: 2, max: 3 },
};

const cc = (value: number) => ({ value, unit: "cc" as const });
const INDICATIVE = { code: "indicative_price" as const };
const PAID_MORE = { code: "paid_more_than_quoted" as const, avgGapPct: 15 };

const record = (i: number, unit: number, extra: Partial<PriceRecord> = {}): PriceRecord => ({
  id: `pr_t_${i}`,
  procedureId: "rejuran_healer",
  product: "Rejuran Healer",
  area: "sinsa",
  amount: cc(2),
  paidKrw: unit * 2,
  normalizedUnitKrw: unit,
  source: "shared_record",
  verified: true,
  date: "2026-11-01",
  ...extra,
});

beforeEach(setupPlatformTest);
afterEach(teardownPlatformTest);

describe("judgeQuote: 07 기준 테스트 케이스 (fixed reference sample)", () => {
  it("Mint 1cc 99,000 VAT incl: low price band but below the typical dose, so underdosed", () => {
    const v = judgeQuote({ quoteId: "qt_mint", amount: cc(1), priceKrw: 99_000, vatIncluded: true }, REFERENCE, [INDICATIVE]);
    expect(v).toMatchObject({
      normalizedUnitKrw: 99_000,
      priceBand: "low",
      doseFlag: "below_typical",
      typicalAmount: { min: 2, max: 3, unit: "cc" },
      clinicFlags: [INDICATIVE],
      label: "underdosed",
      confidence: "high",
      sampleSize: 42,
    });
    expect(v.explanation.ko).toContain("1cc는 보통 받는 2~3cc보다 적어요");
    expect(v.explanation.ja).toContain("1ccは、通常受ける2~3ccより少ない量です");
  });

  it("Seoul Glow 2cc 340,000 VAT incl: 170,000 per cc, mid, fair", () => {
    const v = judgeQuote({ quoteId: "qt_sg", amount: cc(2), priceKrw: 340_000, vatIncluded: true }, REFERENCE, []);
    expect(v).toMatchObject({ normalizedUnitKrw: 170_000, priceBand: "mid", doseFlag: "within", clinicFlags: [], label: "fair" });
  });

  it("Ara 2cc 300,000 VAT excl: 165,000 per cc, fair with the paid-more warning", () => {
    const v = judgeQuote({ quoteId: "qt_ara", amount: cc(2), priceKrw: 300_000, vatIncluded: false }, REFERENCE, [PAID_MORE, INDICATIVE]);
    expect(v).toMatchObject({ normalizedUnitKrw: 165_000, priceBand: "mid", doseFlag: "within", label: "fair" });
    expect(v.clinicFlags.map((f) => f.code)).toEqual(["paid_more_than_quoted", "indicative_price"]);
    expect(v.explanation.ja).toContain("見積もりより支払額が高かった記録があります（平均+15%）");
  });

  it("Hanbit 2cc 420,000 VAT incl: 210,000 per cc, high", () => {
    const v = judgeQuote({ quoteId: "qt_hb", amount: cc(2), priceKrw: 420_000, vatIncluded: true }, REFERENCE, [INDICATIVE]);
    expect(v).toMatchObject({ normalizedUnitKrw: 210_000, priceBand: "high", doseFlag: "within", label: "high" });
  });

  it("every verdict is a valid pibu/fairness-verdict@1", () => {
    const v = judgeQuote({ quoteId: "qt_x", amount: cc(2), priceKrw: 300_000, vatIncluded: false }, REFERENCE, [PAID_MORE]);
    const list = { schema: "pibu/fairness-verdict-list@1", requestId: "req_t", verdicts: [v] };
    expect(PIBU_SCHEMAS["pibu/fairness-verdict-list@1"].safeParse(list).success).toBe(true);
  });
});

describe("judgeQuote: boundaries", () => {
  const at = (unit: number) => judgeQuote({ quoteId: "qt_b", amount: cc(2), priceKrw: unit * 2, vatIncluded: true }, REFERENCE, []);

  it("x = p75 exactly is mid, x = p90 exactly is high, above p90 is very_high", () => {
    expect(at(185_000).priceBand).toBe("mid");
    expect(at(185_001).priceBand).toBe("high");
    expect(at(210_000).priceBand).toBe("high");
    expect(at(210_001)).toMatchObject({ priceBand: "very_high", label: "very_high" });
    expect(at(139_999)).toMatchObject({ priceBand: "low", label: "good_deal" });
  });

  it("n = 4 is insufficient_data, n = 5 is judged", () => {
    const now = clock.now();
    const units = [150_000, 160_000, 170_000, 180_000, 190_000];
    const four = buildReference(selectReferenceSample(units.slice(0, 4).map((u, i) => record(i, u)), { procedureId: "rejuran_healer", region: "gangnam_sinsa", now }), { min: 2, max: 3 });
    const five = buildReference(selectReferenceSample(units.map((u, i) => record(i, u)), { procedureId: "rejuran_healer", region: "gangnam_sinsa", now }), { min: 2, max: 3 });
    const quote = { quoteId: "qt_n", amount: cc(2), priceKrw: 340_000, vatIncluded: true };

    expect(four.n).toBe(4);
    expect(judgeQuote(quote, four, [])).toMatchObject({ priceBand: "insufficient", label: "insufficient_data", confidence: "none" });
    expect(five.n).toBe(5);
    expect(judgeQuote(quote, five, [])).toMatchObject({ priceBand: "mid", label: "fair", confidence: "low" });
  });

  it("an underdosed quote stays underdosed even without enough records", () => {
    const empty = buildReference({ records: [], region: "seoul" }, { min: 2, max: 3 });
    expect(judgeQuote({ quoteId: "qt_u", amount: cc(1), priceKrw: 99_000, vatIncluded: true }, empty, []).label).toBe("underdosed");
  });
});

describe("reference sample selection", () => {
  const now = () => clock.now();

  it("widens to Seoul when the region group has fewer than 5 records", () => {
    const records = [record(1, 150_000), record(2, 160_000, { area: "myeongdong" }), record(3, 170_000, { area: "hongdae" }), record(4, 180_000, { area: "hongdae" }), record(5, 190_000, { area: "other" })];
    const sel = selectReferenceSample(records, { procedureId: "rejuran_healer", region: "gangnam_sinsa", now: now() });
    expect(sel.region).toBe("seoul");
    expect(sel.records).toHaveLength(5);
  });

  it("drops unverified, public offers and records older than 120 days (the 120th day is included)", () => {
    const keep = [1, 2, 3, 4].map((i) => record(i, 150_000 + i * 1000));
    const boundary = record(5, 160_000, { date: "2026-07-15" });
    const old = record(6, 160_000, { date: "2026-07-14" });
    const unverified = record(7, 160_000, { verified: false });
    const publicOffer = record(8, 160_000, { source: "public_offer" });
    const sel = selectReferenceSample([...keep, boundary, old, unverified, publicOffer], { procedureId: "rejuran_healer", region: "gangnam_sinsa", now: now() });
    expect(sel.records.map((r) => r.id).sort()).toEqual(["pr_t_1", "pr_t_2", "pr_t_3", "pr_t_4", "pr_t_5"]);
  });

  it("filters by product only when 5 or more records remain", () => {
    const hb = [1, 2, 3, 4].map((i) => record(i, 200_000, { product: "Rejuran HB" }));
    const healer = [5, 6, 7, 8, 9, 10].map((i) => record(i, 150_000));
    expect(selectReferenceSample([...hb, ...healer], { procedureId: "rejuran_healer", region: "gangnam_sinsa", product: "Rejuran HB", now: now() }).records).toHaveLength(10);
    expect(selectReferenceSample([...hb, ...healer], { procedureId: "rejuran_healer", region: "gangnam_sinsa", product: "Rejuran Healer", now: now() }).records).toHaveLength(6);
  });

  it("drops 3 IQR outliers and reports them", () => {
    const records = [...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => record(i, 150_000 + i * 1000)), record(9, 900_000)];
    const sel = selectReferenceSample(records, { procedureId: "rejuran_healer", region: "gangnam_sinsa", now: now() });
    expect(sel.outliers.map((r) => r.id)).toEqual(["pr_t_9"]);
    expect(sel.records).toHaveLength(8);
  });

  it("typical amount comes from the sample at n >= 10, from the master below", () => {
    const amounts = [1, 1, 1.5, 1.5, 1.5, 1.5, 2, 2, 2, 2];
    const records = amounts.map((value, i) => record(i, 150_000, { amount: cc(value), paidKrw: 150_000 * value }));
    const master = { min: 2, max: 3 };
    expect(buildReference({ records, region: "gangnam_sinsa" }, master).typicalAmount).toEqual({ min: 1.5, max: 2 });
    expect(buildReference({ records: records.slice(0, 9), region: "gangnam_sinsa" }, master).typicalAmount).toEqual(master);
  });

  it("the seed gives the 07 reference: n = 42 and the four quantiles, typical 2~3cc", async () => {
    const { reference } = referenceFor(await platformStore.priceRecords(), { procedureId: "rejuran_healer", area: "sinsa", now: now() });
    expect(reference).toEqual({ ...REFERENCE });
  });
});

describe("clinic flags", () => {
  const outcome = (gap: number, daysAgo: number): Outcome =>
    ({ quoteGapRatio: gap, submittedAt: new Date(clock.now().getTime() - daysAgo * 86_400_000).toISOString() }) as Outcome;

  it("paid_more_than_quoted needs n >= 3 and a mean gap above 0.10 within 90 days", () => {
    const now = clock.now();
    expect(clinicFlagsFor({ outcomes: [outcome(0.2, 1), outcome(0.2, 2)], operationMode: "clinic", now })).toEqual([]);
    expect(clinicFlagsFor({ outcomes: [outcome(0.2, 1), outcome(0.2, 2), outcome(0.2, 91)], operationMode: "clinic", now })).toEqual([]);
    expect(clinicFlagsFor({ outcomes: [outcome(0.1, 1), outcome(0.1, 2), outcome(0.1, 3)], operationMode: "clinic", now })).toEqual([]);
    expect(clinicFlagsFor({ outcomes: [outcome(0.12, 1), outcome(0.14, 2), outcome(0.16, 3)], operationMode: "proxy", now })).toEqual([
      { code: "paid_more_than_quoted", avgGapPct: 14 },
      { code: "indicative_price" },
    ]);
  });
});

describe("judgeQuotes (store adapter, seed sample)", () => {
  it("judges the three Yuki quotes as in 07 and keeps a JudgedQuote per quote", async () => {
    const list = await judgeQuotes({
      schema: "pibu/judge-request@1",
      requestId: "req_t1",
      matchId: "mt_t1",
      quotes: [
        { quoteId: "qt_mint", clinicId: "cln_mint", procedureId: "rejuran_healer", amount: cc(1), priceKrw: 99_000, vatIncluded: true, includes: [] },
        { quoteId: "qt_sg", clinicId: "cln_seoul_glow", procedureId: "rejuran_healer", amount: cc(2), priceKrw: 340_000, vatIncluded: true, includes: [] },
        { quoteId: "qt_ara", clinicId: "cln_ara", procedureId: "rejuran_healer", amount: cc(2), priceKrw: 300_000, vatIncluded: false, includes: [] },
      ],
    });
    expect(list.verdicts.map((v) => [v.quoteId, v.label, v.priceBand, v.sampleSize])).toEqual([
      ["qt_mint", "underdosed", "low", 42],
      ["qt_sg", "fair", "mid", 42],
      ["qt_ara", "fair", "mid", 42],
    ]);
    expect(list.verdicts[0].clinicFlags).toEqual([{ code: "indicative_price" }]);
    expect(list.verdicts[2].clinicFlags).toEqual([{ code: "paid_more_than_quoted", avgGapPct: 15 }, { code: "indicative_price" }]);
    const judged = await platformStore.judgedQuotes();
    expect(judged.map((j) => [j.id, j.matchId, j.verdict.label])).toEqual([
      ["jq_qt_mint", "mt_t1", "underdosed"],
      ["jq_qt_sg", "mt_t1", "fair"],
      ["jq_qt_ara", "mt_t1", "fair"],
    ]);
  });
});
