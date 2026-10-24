// Generates data/seed/price-records.json (06-data-model.md seed table, 10-build-plan.md T03).
//
// Rejuran gangnam_sinsa verified records: exactly 42, unit price p25/p50/p75/p90 = 140k/160k/185k/210k
// (linear interpolation, the same rule as lib/agents/platform/stats.ts), amount p25 = 2 and p75 = 3 after
// rounding to 0.5. Dates 2026-07-16 .. 2026-10-22: inside the 120 day window for both the demo clock in
// lib/clock.ts (2026-10-24) and the 06 reference date (2026-11-12), so the sample is n = 42 under either.
// Plus records that must stay out of that sample (unverified, public_offer, too old) and 10~20 records
// for other regions and procedures. Deterministic: no randomness, run it again and the file is identical.
//
// Usage: node scripts/gen-price-records.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../data/seed/price-records.json", import.meta.url));

function quantile(sorted, p) {
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

const roundHalf = (x) => Math.round(x * 2) / 2;

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** n dates spread evenly from `from` to `to` (inclusive). */
function spread(from, to, n) {
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000;
  return Array.from({ length: n }, (_, i) => addDays(from, n === 1 ? 0 : Math.round((span * i) / (n - 1))));
}

// 42 sorted unit prices. Indexes 10/11, 20/21, 30/31, 36/37 pin the four quantiles exactly.
const UNIT_PRICES = [
  110000, 115000, 120000, 125000, 128000, 130000, 132000, 134000, 136000, 138000,
  140000, 140000, 142000, 145000, 148000, 150000, 152000, 154000, 156000, 158000,
  160000, 160000, 163000, 166000, 169000, 172000, 175000, 178000, 180000, 183000,
  185000, 185000, 190000, 195000, 200000, 205000, 210000, 210000, 215000, 220000,
  225000, 230000,
];
// 4 x 1cc, 22 x 2cc, 14 x 3cc, 2 x 4cc: sorted index 10.25 -> 2, 30.75 -> 3.
const AMOUNTS = [...Array(4).fill(1), ...Array(22).fill(2), ...Array(14).fill(3), ...Array(2).fill(4)];
// Interleave amounts so price and dose are not trivially correlated.
const AMOUNT_ORDER = [2, 3, 2, 1, 2, 3, 2, 2, 3, 2, 4, 2, 3, 2, 2, 3, 1, 2, 3, 2, 2, 3, 2, 3, 2, 1, 3, 2, 2, 3, 2, 3, 4, 2, 3, 2, 1, 2, 3, 2, 3, 2];
const AREAS_GS = ["sinsa", "gangnam", "apgujeong"];
const CLINICS_GS = ["cln_seoul_glow", "cln_mint", "cln_ara", undefined];
const AGE_BANDS = ["25-29", "30-34", "20-24", "35-39", "40+"];

function check(condition, message) {
  if (!condition) throw new Error(`price-records: ${message}`);
}

check(UNIT_PRICES.length === 42, "need 42 unit prices");
check(AMOUNT_ORDER.length === 42, "need 42 amounts");
check([...AMOUNT_ORDER].sort((a, b) => a - b).join() === AMOUNTS.join(), "amount mix changed");

const records = [];
let seq = 0;
const id = () => `pr_${String(++seq).padStart(4, "0")}`;

const rejuranDates = spread("2026-07-16", "2026-10-22", 42);
UNIT_PRICES.forEach((unit, i) => {
  const amount = AMOUNT_ORDER[i];
  const shared = i % 3 !== 0; // two thirds Korean women's shared records, one third foreign outcomes
  records.push({
    id: id(),
    procedureId: "rejuran_healer",
    product: "Rejuran Healer",
    area: AREAS_GS[i % 3],
    amount: { value: amount, unit: "cc" },
    paidKrw: unit * amount,
    normalizedUnitKrw: unit,
    source: shared ? "shared_record" : "outcome",
    verified: true,
    ageBand: AGE_BANDS[i % AGE_BANDS.length],
    nationalityGroup: shared ? "KR" : "foreign",
    ...(CLINICS_GS[i % 4] ? { clinicId: CLINICS_GS[i % 4] } : {}),
    date: rejuranDates[(i * 17) % 42],
  });
});

// Must be excluded from the verdict sample: unverified, public offers, and older than any window.
const excluded = [
  { source: "shared_record", verified: false, unit: 95000, date: "2026-09-02" },
  { source: "shared_record", verified: false, unit: 260000, date: "2026-09-18" },
  { source: "outcome", verified: false, unit: 175000, date: "2026-10-05" },
  { source: "public_offer", verified: true, unit: 99000, date: "2026-10-01" },
  { source: "public_offer", verified: true, unit: 120000, date: "2026-10-10" },
  { source: "shared_record", verified: true, unit: 150000, date: "2026-05-20" },
  { source: "shared_record", verified: true, unit: 155000, date: "2026-06-02" },
  { source: "outcome", verified: true, unit: 165000, date: "2026-06-12" },
];
excluded.forEach((r, i) => {
  records.push({
    id: id(),
    procedureId: "rejuran_healer",
    product: "Rejuran Healer",
    area: AREAS_GS[i % 3],
    amount: { value: 2, unit: "cc" },
    paidKrw: r.unit * 2,
    normalizedUnitKrw: r.unit,
    source: r.source,
    verified: r.verified,
    nationalityGroup: r.source === "outcome" ? "foreign" : "KR",
    date: r.date,
  });
});

// Other regions and procedures, 10~20 each.
const OTHER = [
  // myeongdong: p75 204,000 < 210,000 <= p90 211,800, so Hanbit 2cc 420,000 is "high" end to end too (07 table).
  { procedureId: "rejuran_healer", product: "Rejuran Healer", unit: "cc", areas: ["myeongdong"], amount: 2, base: 165000, step: 4000, n: 14 },
  { procedureId: "rejuran_healer", product: "Rejuran Healer", unit: "cc", areas: ["hongdae"], amount: 2, base: 150000, step: 3500, n: 12 },
  { procedureId: "thermage_flx", product: "Thermage FLX", unit: "shot", areas: ["gangnam", "sinsa", "apgujeong"], amount: 300, base: 4500, step: 150, n: 12 },
  { procedureId: "botox_forehead", product: "Botox (domestic)", unit: "unit", areas: ["gangnam", "sinsa", "myeongdong", "hongdae"], amount: 50, base: 2400, step: 100, n: 15 },
  { procedureId: "juvelook_volume", product: "Juvelook Volume", unit: "vial", areas: ["apgujeong", "gangnam", "hongdae"], amount: 1, base: 380000, step: 12000, n: 10 },
  { procedureId: "ulthera", product: "Ulthera", unit: "shot", areas: ["hongdae", "gangnam"], amount: 300, base: 4000, step: 200, n: 11 },
];
for (const group of OTHER) {
  const dates = spread("2026-07-20", "2026-10-20", group.n);
  for (let i = 0; i < group.n; i++) {
    const unit = group.base + group.step * ((i * 5) % group.n);
    records.push({
      id: id(),
      procedureId: group.procedureId,
      product: group.product,
      area: group.areas[i % group.areas.length],
      amount: { value: group.amount, unit: group.unit },
      paidKrw: unit * group.amount,
      normalizedUnitKrw: unit,
      source: i % 2 === 0 ? "shared_record" : "outcome",
      verified: true,
      ageBand: AGE_BANDS[i % AGE_BANDS.length],
      nationalityGroup: i % 2 === 0 ? "KR" : "foreign",
      date: dates[i],
    });
  }
}

// Self check: the sample the platform will see.
const sample = records.filter(
  (r) =>
    r.procedureId === "rejuran_healer" &&
    r.verified &&
    r.source !== "public_offer" &&
    AREAS_GS.includes(r.area) &&
    r.date >= "2026-07-15" &&
    r.date <= "2026-10-24",
);
const units = sample.map((r) => r.normalizedUnitKrw).sort((a, b) => a - b);
const amounts = sample.map((r) => r.amount.value).sort((a, b) => a - b);
check(sample.length === 42, `sample n = ${sample.length}`);
check(quantile(units, 0.25) === 140000, `p25 ${quantile(units, 0.25)}`);
check(quantile(units, 0.5) === 160000, `p50 ${quantile(units, 0.5)}`);
check(quantile(units, 0.75) === 185000, `p75 ${quantile(units, 0.75)}`);
check(quantile(units, 0.9) === 210000, `p90 ${quantile(units, 0.9)}`);
check(roundHalf(quantile(amounts, 0.25)) === 2, "amount p25");
check(roundHalf(quantile(amounts, 0.75)) === 3, "amount p75");
check(sample.every((r) => r.date >= "2026-07-16" && r.date <= "2026-10-22"), "dates out of range");

const md = records
  .filter((r) => r.procedureId === "rejuran_healer" && r.area === "myeongdong" && r.verified && r.source !== "public_offer")
  .map((r) => r.normalizedUnitKrw);
check(quantile([...md].sort((a, b) => a - b), 0.75) < 210000 && 210000 <= quantile([...md].sort((a, b) => a - b), 0.9), "myeongdong band for Hanbit");

const text = `${JSON.stringify(records, null, 2)}\n`;
if (process.argv.includes("--check")) {
  const current = readFileSync(out, "utf8");
  if (current !== text) {
    console.error("data/seed/price-records.json is out of date: run node scripts/gen-price-records.mjs");
    process.exit(1);
  }
  console.log(`price-records.json up to date (${records.length} records, rejuran gangnam_sinsa n = 42)`);
} else {
  writeFileSync(out, text);
  console.log(`wrote ${records.length} records (rejuran gangnam_sinsa n = 42) to ${out}`);
}
