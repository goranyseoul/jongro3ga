// Generates data/seed/outcomes.json and data/seed/outcomes-ara-burst.json (06-data-model.md seed table).
// Usage: node scripts/gen-outcomes.mjs   (the output is committed)
//
// outcomes.json, 30 outcomes against the demo day 2026-11-12:
//  - Ara, Japanese visitors, 4 outcomes, quoteGapRatio 0.12 / 0.14 / 0.16 / 0.18 (mean 0.15), dated
//    2026-08-14 .. 2026-10-12 at 15:00 KST: inside the 90 day clinic flag window, outside the 30 day trigger window
//    whether the windows compare dates or times.
//  - 26 more at the other four clinics with gaps of 0 .. 0.05 and satisfaction 3 .. 5, so no other clinic gets
//    a "paid more than quoted" flag and no proposer trigger fires before the burst.
// outcomes-ara-burst.json, 20 templates injected by the demo control: dates are computed at injection time from
// `daysAgo` (1 .. 29) by materializeAraBurst(now) in lib/store/seed.ts. quoteGapRatio runs 0.25 .. 0.37 in 20
// equal steps, both ends included. Values are rounded to 6 decimals symmetrically (x_k + x_19-k = 0.62), so the
// mean is exactly 0.31.
import { writeFileSync } from "node:fs";

const SEED_DIR = new URL("../data/seed/", import.meta.url);
const write = (name, rows) =>
  writeFileSync(new URL(name, SEED_DIR), `[\n${rows.map((r) => `  ${JSON.stringify(r)}`).join(",\n")}\n]\n`);

const PRODUCT = {
  rejuran_healer: "Rejuran Healer",
  botox_forehead: "Botulinum toxin (domestic)",
  shrink_universe: "Shrink Universe",
  laser_toning: "Laser toning",
  ulthera: "Ulthera",
};

/** Ara's 2 cc Rejuran quote is 300,000 VAT excluded: 330,000 normalized (07 "입력 정규화"). */
const ARA_QUOTED = 330000;

function outcome(n, row) {
  const {
    clinicId, procedureId, amount, quotedKrw, gap, at, nationality, ageBand, satisfaction,
    painScore = 3, downtime = 1, wouldReturn = true, comment,
  } = row;
  const id = `out_seed_${String(n).padStart(3, "0")}`;
  return {
    schema: "pibu/outcome@1",
    outcomeId: id,
    bookingId: `bkg_seed_${String(n).padStart(3, "0")}`,
    clinicId,
    procedureId,
    checkpoint: "D0",
    paidKrw: Math.round(quotedKrw * (1 + gap)),
    receivedAmount: amount,
    productVerified: PRODUCT[procedureId],
    receiptAttached: true,
    satisfaction,
    painScore,
    downtimeDaysActual: downtime,
    wouldReturn,
    sideEffects: [],
    ...(comment ? { comment } : {}),
    visitorProfile: { nationality, ageBand },
    submittedAt: at,
    id,
    receivedAt: at,
    quotedKrw,
    quoteGapRatio: gap,
  };
}

const cc = (value) => ({ value, unit: "cc" });
const t = (date) => `${date}T15:00:00+09:00`;

const BASE = [
  // Ara, Japanese visitors: the 90 day flag ("paid_more_than_quoted", mean +15%)
  { clinicId: "cln_ara", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: ARA_QUOTED, gap: 0.12, at: t("2026-08-14"), nationality: "JP", ageBand: "25-29", satisfaction: 3, comment: "見積もりより少し高くなりました。" },
  { clinicId: "cln_ara", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: ARA_QUOTED, gap: 0.14, at: t("2026-09-03"), nationality: "JP", ageBand: "30-34", satisfaction: 4 },
  { clinicId: "cln_ara", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: ARA_QUOTED, gap: 0.16, at: t("2026-09-22"), nationality: "JP", ageBand: "20-24", satisfaction: 3, wouldReturn: false },
  { clinicId: "cln_ara", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: ARA_QUOTED, gap: 0.18, at: t("2026-10-12"), nationality: "JP", ageBand: "35-39", satisfaction: 3, comment: "追加料金の説明が当日でした。" },

  // Seoul Glow
  { clinicId: "cln_seoul_glow", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: 340000, gap: 0, at: t("2026-07-28"), nationality: "JP", ageBand: "25-29", satisfaction: 5 },
  { clinicId: "cln_seoul_glow", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: 340000, gap: 0, at: t("2026-08-21"), nationality: "JP", ageBand: "30-34", satisfaction: 4, comment: "日本語で説明してもらえて安心でした。" },
  { clinicId: "cln_seoul_glow", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: 340000, gap: 0, at: t("2026-09-09"), nationality: "JP", ageBand: "25-29", satisfaction: 5 },
  { clinicId: "cln_seoul_glow", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: 340000, gap: 0, at: t("2026-10-02"), nationality: "JP", ageBand: "20-24", satisfaction: 4, downtime: 2 },
  { clinicId: "cln_seoul_glow", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: 340000, gap: 0, at: t("2026-10-25"), nationality: "JP", ageBand: "35-39", satisfaction: 5 },
  { clinicId: "cln_seoul_glow", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: 340000, gap: 0, at: t("2026-11-06"), nationality: "JP", ageBand: "25-29", satisfaction: 4 },
  { clinicId: "cln_seoul_glow", procedureId: "botox_forehead", amount: { value: 50, unit: "unit" }, quotedKrw: 110000, gap: 0, at: t("2026-08-30"), nationality: "JP", ageBand: "30-34", satisfaction: 4, downtime: 0 },
  { clinicId: "cln_seoul_glow", procedureId: "botox_forehead", amount: { value: 50, unit: "unit" }, quotedKrw: 110000, gap: 0, at: t("2026-10-18"), nationality: "JP", ageBand: "40+", satisfaction: 5, downtime: 0 },

  // Mint
  { clinicId: "cln_mint", procedureId: "rejuran_healer", amount: cc(1), quotedKrw: 99000, gap: 0, at: t("2026-08-08"), nationality: "JP", ageBand: "20-24", satisfaction: 3, comment: "1ccだと少なく感じました。" },
  { clinicId: "cln_mint", procedureId: "rejuran_healer", amount: cc(1), quotedKrw: 99000, gap: 0, at: t("2026-09-14"), nationality: "JP", ageBand: "25-29", satisfaction: 4 },
  { clinicId: "cln_mint", procedureId: "rejuran_healer", amount: cc(1), quotedKrw: 99000, gap: 0.05, at: t("2026-10-07"), nationality: "JP", ageBand: "25-29", satisfaction: 3 },
  { clinicId: "cln_mint", procedureId: "rejuran_healer", amount: cc(1), quotedKrw: 99000, gap: 0, at: t("2026-11-03"), nationality: "US", ageBand: "20-24", satisfaction: 4 },
  { clinicId: "cln_mint", procedureId: "shrink_universe", amount: { value: 300, unit: "shot" }, quotedKrw: 99000, gap: 0, at: t("2026-09-27"), nationality: "JP", ageBand: "30-34", satisfaction: 4, downtime: 0 },

  // Hanbit
  { clinicId: "cln_hanbit", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: 420000, gap: 0, at: t("2026-07-24"), nationality: "CN", ageBand: "30-34", satisfaction: 4, comment: "中文沟通很顺利。" },
  { clinicId: "cln_hanbit", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: 420000, gap: 0.05, at: t("2026-08-17"), nationality: "CN", ageBand: "25-29", satisfaction: 4 },
  { clinicId: "cln_hanbit", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: 420000, gap: 0, at: t("2026-09-17"), nationality: "CN", ageBand: "30-34", satisfaction: 5 },
  { clinicId: "cln_hanbit", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: 420000, gap: 0, at: t("2026-10-15"), nationality: "CN", ageBand: "35-39", satisfaction: 4, downtime: 2 },
  { clinicId: "cln_hanbit", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: 420000, gap: 0, at: t("2026-11-01"), nationality: "CN", ageBand: "20-24", satisfaction: 4 },
  { clinicId: "cln_hanbit", procedureId: "laser_toning", amount: { value: 1, unit: "session" }, quotedKrw: 70000, gap: 0, at: t("2026-09-05"), nationality: "CN", ageBand: "25-29", satisfaction: 4, downtime: 0 },
  { clinicId: "cln_hanbit", procedureId: "laser_toning", amount: { value: 1, unit: "session" }, quotedKrw: 70000, gap: 0, at: t("2026-10-28"), nationality: "CN", ageBand: "30-34", satisfaction: 3, downtime: 0 },

  // Dahye
  { clinicId: "cln_dahye", procedureId: "ulthera", amount: { value: 300, unit: "shot" }, quotedKrw: 1500000, gap: 0, at: t("2026-08-02"), nationality: "US", ageBand: "35-39", satisfaction: 4, painScore: 6, downtime: 0 },
  { clinicId: "cln_dahye", procedureId: "ulthera", amount: { value: 300, unit: "shot" }, quotedKrw: 1500000, gap: 0, at: t("2026-10-10"), nationality: "US", ageBand: "40+", satisfaction: 5, painScore: 7, downtime: 0, comment: "Back to sightseeing the next day." },
  { clinicId: "cln_dahye", procedureId: "botox_forehead", amount: { value: 50, unit: "unit" }, quotedKrw: 130000, gap: 0, at: t("2026-09-01"), nationality: "US", ageBand: "25-29", satisfaction: 5, downtime: 0 },
  { clinicId: "cln_dahye", procedureId: "botox_forehead", amount: { value: 50, unit: "unit" }, quotedKrw: 130000, gap: 0, at: t("2026-10-21"), nationality: "US", ageBand: "30-34", satisfaction: 4, downtime: 0 },
  { clinicId: "cln_dahye", procedureId: "rejuran_healer", amount: cc(2), quotedKrw: 360000, gap: 0, at: t("2026-09-30"), nationality: "US", ageBand: "25-29", satisfaction: 4 },
  { clinicId: "cln_dahye", procedureId: "shrink_universe", amount: { value: 300, unit: "shot" }, quotedKrw: 120000, gap: 0.03, at: t("2026-11-05"), nationality: "US", ageBand: "20-24", satisfaction: 4, downtime: 0 },
];

const outcomes = BASE.map((row, i) => outcome(i + 1, row));
if (outcomes.length !== 30) throw new Error(`expected 30 outcomes, got ${outcomes.length}`);
write("outcomes.json", outcomes);

// ---- Ara burst templates ----

const round6 = (x) => Math.round(x * 1e6) / 1e6;
const STEP = 0.12 / 19;
const gaps = Array.from({ length: 20 }, (_, k) => (k < 10 ? round6(0.25 + k * STEP) : round6(0.62 - round6(0.25 + (19 - k) * STEP))));
const AGE_BANDS = ["20-24", "25-29", "30-34", "35-39", "25-29"];
const burst = gaps.map((gap, k) => {
  const id = `out_ara_burst_${String(k + 1).padStart(2, "0")}`;
  return {
    schema: "pibu/outcome@1",
    outcomeId: id,
    bookingId: `bkg_ara_burst_${String(k + 1).padStart(2, "0")}`,
    clinicId: "cln_ara",
    procedureId: "rejuran_healer",
    checkpoint: "D0",
    paidKrw: Math.round(ARA_QUOTED * (1 + gap)),
    receivedAmount: cc(2),
    productVerified: PRODUCT.rejuran_healer,
    receiptAttached: true,
    // 6 of 20 at 2: below the low satisfaction trigger (ratio > 0.4), so the burst proposes one rule only
    satisfaction: k % 10 < 3 ? 2 : 3,
    painScore: 4,
    downtimeDaysActual: 1,
    wouldReturn: false,
    sideEffects: [],
    visitorProfile: { nationality: "JP", ageBand: AGE_BANDS[k % AGE_BANDS.length] },
    id,
    quotedKrw: ARA_QUOTED,
    quoteGapRatio: gap,
    // 1 .. 29 days before the injection time, oldest first
    daysAgo: 29 - Math.floor((k * 28) / 19),
  };
});
write("outcomes-ara-burst.json", burst);
const mean = burst.reduce((sum, row) => sum + row.quoteGapRatio, 0) / burst.length;
console.log(`wrote ${outcomes.length} outcomes and ${burst.length} burst templates (mean gap ${mean})`);
