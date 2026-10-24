// Generates data/seed/outcomes.json and data/seed/outcomes-ara-burst.json (06-data-model.md seed table).
//
// outcomes.json, 30 base outcomes. Ara's 4 Japanese outcomes average quoteGapRatio +0.15 and are dated
// 2026-08-16 .. 2026-09-20: 31~90 days before both the demo clock (2026-10-24) and the 06 reference date
// (2026-11-12), so they count for the 90 day clinic flag and stay out of the 30 day proposer triggers.
// No other segment reaches a proposer trigger. Seed outcomes never create PriceRecords (n = 42 stays).
//
// outcomes-ara-burst.json, 20 demo injection templates for Ara x JP: quoteGapRatio 0.25 .. 0.37 evenly
// spaced (both ends included, mean exactly 0.31), `daysAgo` 1~29 is turned into dates relative to
// clock.now() at injection time (araBurstOutcomes in data/seed/load.ts).
//
// Usage: node scripts/gen-outcomes.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const outBase = fileURLToPath(new URL("../data/seed/outcomes.json", import.meta.url));
const outBurst = fileURLToPath(new URL("../data/seed/outcomes-ara-burst.json", import.meta.url));

const round4 = (x) => Math.round(x * 10000) / 10000;

// clinic quote for rejuran 2cc, VAT included (07 table)
const QUOTED = { cln_seoul_glow: 340000, cln_mint: 99000, cln_ara: 330000, cln_hanbit: 420000, cln_dahye: 360000 };
const AMOUNT = { cln_seoul_glow: 2, cln_mint: 1, cln_ara: 2, cln_hanbit: 2, cln_dahye: 2 };

// [clinic, nationality, ageBand, gap, satisfaction, pain, date, comment]
const BASE = [
  ["cln_ara", "JP", "25-29", 0.12, 3, 4, "2026-08-16", "Final price was higher than the quote."],
  ["cln_ara", "JP", "30-34", 0.14, 4, 3, "2026-08-29", "An extra fee was added at the clinic."],
  ["cln_ara", "JP", "25-29", 0.16, 3, 4, "2026-09-08", "Paid more than quoted."],
  ["cln_ara", "JP", "35-39", 0.18, 3, 3, "2026-09-20", "Numbing cream was charged separately."],
  ["cln_seoul_glow", "JP", "25-29", 0, 5, 3, "2026-07-20", "Explained everything in Japanese."],
  ["cln_seoul_glow", "JP", "30-34", 0, 5, 2, "2026-07-29", "Same price as the quote."],
  ["cln_seoul_glow", "CN", "30-34", 0.02, 4, 3, "2026-08-06", "Smooth visit."],
  ["cln_seoul_glow", "US", "25-29", 0, 5, 3, "2026-08-14", "Clear explanation."],
  ["cln_seoul_glow", "JP", "20-24", 0, 4, 4, "2026-08-25", "A bit painful but fine."],
  ["cln_seoul_glow", "JP", "25-29", 0.03, 5, 3, "2026-09-03", "Coordinator was helpful."],
  ["cln_seoul_glow", "US", "30-34", 0, 4, 3, "2026-09-12", "Good."],
  ["cln_seoul_glow", "JP", "35-39", 0, 5, 2, "2026-09-22", "Would come back."],
  ["cln_seoul_glow", "CN", "25-29", 0.01, 4, 3, "2026-09-30", "On time."],
  ["cln_seoul_glow", "JP", "25-29", 0, 5, 3, "2026-10-08", "Same as quoted."],
  ["cln_seoul_glow", "US", "40+", 0, 4, 3, "2026-10-15", "Fine."],
  ["cln_seoul_glow", "JP", "30-34", 0.02, 5, 2, "2026-10-20", "Very kind staff."],
  ["cln_mint", "JP", "25-29", 0.04, 3, 3, "2026-07-25", "Only 1cc was included."],
  ["cln_mint", "US", "20-24", 0.02, 4, 3, "2026-08-20", "Cheap event price."],
  ["cln_mint", "JP", "30-34", 0.05, 3, 4, "2026-09-10", "Small dose."],
  ["cln_mint", "CN", "25-29", 0.03, 4, 3, "2026-09-28", "OK."],
  ["cln_mint", "JP", "25-29", 0.04, 3, 3, "2026-10-12", "Busy clinic."],
  ["cln_hanbit", "CN", "30-34", 0, 4, 3, "2026-07-27", "Chinese speaking staff."],
  ["cln_hanbit", "CN", "35-39", 0.02, 4, 3, "2026-08-22", "Good service."],
  ["cln_hanbit", "JP", "25-29", 0.04, 4, 4, "2026-09-15", "Fine."],
  ["cln_hanbit", "CN", "25-29", 0, 5, 2, "2026-10-02", "Easy to book."],
  ["cln_hanbit", "US", "30-34", 0.01, 4, 3, "2026-10-18", "Central location."],
  ["cln_dahye", "US", "25-29", 0, 5, 3, "2026-08-02", "English was perfect."],
  ["cln_dahye", "US", "30-34", 0.02, 4, 3, "2026-08-30", "Good value."],
  ["cln_dahye", "CN", "25-29", 0, 4, 3, "2026-09-25", "Fine."],
  ["cln_dahye", "US", "20-24", 0, 5, 2, "2026-10-10", "Friendly."],
];

function check(condition, message) {
  if (!condition) throw new Error(`outcomes: ${message}`);
}

const base = BASE.map(([clinicId, nationality, ageBand, gap, satisfaction, painScore, date, comment], i) => {
  const n = String(i + 1).padStart(3, "0");
  const quotedKrw = QUOTED[clinicId];
  const paidKrw = Math.round(quotedKrw * (1 + gap));
  return {
    id: `out_seed_${n}`,
    schema: "pibu/outcome@1",
    outcomeId: `out_seed_${n}`,
    bookingId: `bkg_seed_${n}`,
    clinicId,
    procedureId: "rejuran_healer",
    checkpoint: "D0",
    paidKrw,
    receivedAmount: { value: AMOUNT[clinicId], unit: "cc" },
    productVerified: i % 3 === 0 ? "vial_shown" : "not_checked",
    receiptAttached: i % 2 === 0,
    satisfaction,
    painScore,
    downtimeDaysActual: null,
    wouldReturn: satisfaction >= 4,
    sideEffects: [],
    comment,
    visitorProfile: { nationality, ageBand },
    submittedAt: `${date}T18:00:00+09:00`,
    receivedAt: `${date}T18:00:05+09:00`,
    quotedKrw,
    quoteGapRatio: round4((paidKrw - quotedKrw) / quotedKrw),
  };
});

check(base.length === 30, "need 30 base outcomes");
const araJp = base.filter((o) => o.clinicId === "cln_ara" && o.visitorProfile.nationality === "JP");
check(araJp.length === 4, "Ara JP must be 4");
const avg = araJp.reduce((s, o) => s + o.quoteGapRatio, 0) / araJp.length;
check(Math.abs(avg - 0.15) < 1e-9, `Ara JP avg gap ${avg}`);
check(araJp.every((o) => o.submittedAt >= "2026-08-14" && o.submittedAt < "2026-09-24"), "Ara dates outside 31~90 days for both clocks");
for (const clinic of Object.keys(QUOTED)) {
  if (clinic === "cln_ara") continue;
  const list = base.filter((o) => o.clinicId === clinic);
  const g = list.reduce((s, o) => s + o.quoteGapRatio, 0) / list.length;
  check(g <= 0.1, `${clinic} avg gap ${g} would raise paid_more_than_quoted`);
}

const BURST_N = 20;
const burst = Array.from({ length: BURST_N }, (_, i) => {
  const n = String(i + 1).padStart(3, "0");
  // 0.25 + i * 0.12 / 19, kept as an exact ratio: the mean of the 20 values is exactly 0.31.
  const quoteGapRatio = round4(0.25 + (i * 0.12) / (BURST_N - 1));
  const quotedKrw = QUOTED.cln_ara;
  return {
    outcomeId: `out_burst_${n}`,
    bookingId: `bkg_burst_${n}`,
    clinicId: "cln_ara",
    procedureId: "rejuran_healer",
    checkpoint: "D0",
    paidKrw: Math.round(quotedKrw * (1 + quoteGapRatio)),
    receivedAmount: { value: 2, unit: "cc" },
    productVerified: "not_checked",
    receiptAttached: i % 2 === 0,
    satisfaction: i % 4 === 0 ? 2 : 3,
    painScore: 4,
    downtimeDaysActual: null,
    wouldReturn: false,
    sideEffects: [],
    comment: "Paid more than the quote at the clinic.",
    visitorProfile: { nationality: "JP", ageBand: ["25-29", "30-34", "20-24", "35-39"][i % 4] },
    quotedKrw,
    quoteGapRatio,
    /** 1..29 days before the injection time. */
    daysAgo: 1 + Math.round((i * 28) / (BURST_N - 1)),
  };
});
const burstMean = burst.reduce((s, o) => s + o.quoteGapRatio, 0) / BURST_N;
check(Math.abs(burstMean - 0.31) < 1e-9, `burst mean ${burstMean}`);
check(burst[0].quoteGapRatio === 0.25 && burst[BURST_N - 1].quoteGapRatio === 0.37, "burst ends");
check(burst.every((o) => o.daysAgo >= 1 && o.daysAgo <= 29), "burst daysAgo");

const files = [
  [outBase, `${JSON.stringify(base, null, 2)}\n`],
  [outBurst, `${JSON.stringify(burst, null, 2)}\n`],
];
if (process.argv.includes("--check")) {
  for (const [path, text] of files) {
    if (readFileSync(path, "utf8") !== text) {
      console.error(`${path} is out of date: run node scripts/gen-outcomes.mjs`);
      process.exit(1);
    }
  }
  console.log("outcomes.json and outcomes-ara-burst.json up to date");
} else {
  for (const [path, text] of files) writeFileSync(path, text);
  console.log(`wrote ${base.length} base outcomes and ${burst.length} burst templates`);
}
