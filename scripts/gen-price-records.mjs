// Generates data/seed/price-records.json (06-data-model.md seed table, 07-platform-intelligence.md "기준 표본").
// Deterministic: a seeded PRNG, so rerunning gives the same file. The output is committed.
//
// Rejuran, region group gangnam_sinsa (gangnam, sinsa, apgujeong): exactly 42 verified records that are not
// public offers, dated 2026-07-16 .. 2026-11-10. Their unit prices are a fixed multiset built so that every
// common quantile definition gives p25 140,000 / p50 160,000 / p75 185,000 / p90 210,000: 07 says "linear
// interpolation" (h = (n - 1) p, numpy and Excel PERCENTILE.INC), and the values on both sides of every
// interpolation point are equal, so nearest rank and the (n + 1) p variant land on the same numbers. Amounts
// give p25 = 2 cc and p75 = 3 cc the same way. No value is an outlier under 07's p25 - 3 IQR .. p75 + 3 IQR fence.
//
// Everything else is 10 to 20 records per (procedure, region group) for the procedures the seed clinics sell,
// plus a few public offers and unverified shared records that the verdict sample must skip.
// Usage: node scripts/gen-price-records.mjs
import { writeFileSync } from "node:fs";

// mulberry32
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = prng(20261112);
const pick = (list) => list[Math.floor(rand() * list.length)];
const between = (min, max) => min + Math.floor(rand() * (max - min + 1));
function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const FIRST_DATE = "2026-07-16";
const LAST_DATE = "2026-11-10";
const SPAN_DAYS = 117; // FIRST_DATE + 117 days = LAST_DATE
function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
if (addDays(FIRST_DATE, SPAN_DAYS) !== LAST_DATE) throw new Error("date span is off");
const randomDate = () => addDays(FIRST_DATE, between(0, SPAN_DAYS));

const AGE_BANDS = ["20-24", "25-29", "30-34", "35-39", "40+"];
const CLINIC_BY_AREA = {
  sinsa: "cln_seoul_glow",
  gangnam: "cln_mint",
  apgujeong: "cln_ara",
  myeongdong: "cln_hanbit",
  hongdae: "cln_dahye",
};

const records = [];
function push(record) {
  records.push({ id: `pr_${String(records.length + 1).padStart(4, "0")}`, ...record });
}

/** A record from a customer outcome (foreign visitor) or a shared Korean record. Registry clinic only some of the time. */
function sourceFields(source, area) {
  const fields = {
    source,
    nationalityGroup: source === "outcome" ? "foreign" : "KR",
    ageBand: pick(AGE_BANDS),
  };
  if (source === "outcome" || rand() < 0.4) fields.clinicId = CLINIC_BY_AREA[area];
  return fields;
}

// ---- Rejuran, gangnam_sinsa: the 42 record verdict sample ----

const REJURAN_UNIT_PRICES = [
  112000, 118000, 122000, 126000, 130000, 132000, 134000, 136000, 138000,
  140000, 140000, 140000, // indices 9..11 around p25 (h = 10.25)
  144000, 147000, 150000, 152000, 154000, 156000, 158000,
  160000, 160000, 160000, 160000, // indices 19..22 around p50 (h = 20.5)
  164000, 167000, 170000, 172000, 175000, 178000,
  185000, 185000, 185000, 185000, // indices 29..32 around p75 (h = 30.75)
  192000, 198000, 204000,
  210000, 210000, 210000, // indices 36..38 around p90 (h = 36.9)
  222000, 235000, 250000,
];
// sorted: indices 0..1 = 1 cc, 2..23 = 2 cc, 24..37 = 3 cc, 38..41 = 4 cc, so p25 (h 10.25) = 2 and p75 (h 30.75) = 3
const REJURAN_AMOUNTS = [...Array(2).fill(1), ...Array(22).fill(2), ...Array(14).fill(3), ...Array(4).fill(4)];
if (REJURAN_UNIT_PRICES.length !== 42 || REJURAN_AMOUNTS.length !== 42) throw new Error("the sample must be 42");

const GANGNAM_SINSA = ["gangnam", "sinsa", "apgujeong"];
const sampleAmounts = shuffle(REJURAN_AMOUNTS);
REJURAN_UNIT_PRICES.forEach((unit, i) => {
  const area = pick(GANGNAM_SINSA);
  const value = sampleAmounts[i];
  // the first and last records sit on the range ends so the whole window is exercised
  const date = i === 0 ? FIRST_DATE : i === 1 ? LAST_DATE : randomDate();
  push({
    procedureId: "rejuran_healer",
    product: "Rejuran Healer",
    area,
    amount: { value, unit: "cc" },
    paidKrw: unit * value,
    normalizedUnitKrw: unit,
    verified: true,
    date,
    ...sourceFields(rand() < 0.45 ? "outcome" : "shared_record", area),
  });
});

// Same procedure and region, never in the verdict sample: public offers and unverified shared records.
for (const [source, unit, value] of [
  ["public_offer", 99000, 1],
  ["public_offer", 125000, 2],
  ["public_offer", 145000, 2],
  ["shared_record", 230000, 2],
  ["shared_record", 95000, 2],
]) {
  const area = pick(GANGNAM_SINSA);
  push({
    procedureId: "rejuran_healer",
    product: "Rejuran Healer",
    area,
    amount: { value, unit: "cc" },
    paidKrw: unit * value,
    normalizedUnitKrw: unit,
    verified: false,
    date: randomDate(),
    ...(source === "public_offer" ? { source, clinicId: CLINIC_BY_AREA[area] } : sourceFields(source, area)),
  });
}

// ---- Other procedures and regions ----

const OTHER_GROUPS = [
  // procedureId, product, areas, unit, amount choices, unit price range (KRW, VAT included), count
  ["rejuran_healer", "Rejuran Healer", ["myeongdong"], "cc", [2, 2, 3], [150000, 230000], 14],
  ["rejuran_healer", "Rejuran Healer", ["hongdae"], "cc", [2, 2, 3], [140000, 200000], 12],
  ["thermage_flx", "Thermage FLX", GANGNAM_SINSA, "shot", [300, 300, 600], [3300, 6000], 14],
  ["thermage_flx", "Thermage FLX", ["myeongdong"], "shot", [300, 600], [3600, 6300], 12],
  ["skin_booster_juvelook", "Juvelook", GANGNAM_SINSA, "vial", [1, 1, 2], [180000, 300000], 12],
  ["botox_forehead", "Botulinum toxin", GANGNAM_SINSA, "unit", [30, 50, 50], [1500, 4000], 14],
  ["botox_forehead", "Botulinum toxin", ["hongdae"], "unit", [30, 50], [1600, 3600], 10],
  ["shrink_universe", "Shrink Universe", GANGNAM_SINSA, "shot", [300, 300, 600], [200, 450], 14],
  ["shrink_universe", "Shrink Universe", ["hongdae"], "shot", [300, 600], [220, 480], 10],
  ["laser_toning", "Laser toning", GANGNAM_SINSA, "session", [1], [40000, 90000], 10],
  ["laser_toning", "Laser toning", ["myeongdong"], "session", [1], [45000, 95000], 12],
  ["pico_toning", "Pico toning", ["myeongdong"], "session", [1], [60000, 140000], 10],
  ["aqua_peel", "Aqua peel", GANGNAM_SINSA, "session", [1], [25000, 55000], 10],
  ["filler", "HA filler", GANGNAM_SINSA, "cc", [1, 1, 2], [80000, 300000], 10],
  ["ulthera", "Ulthera", ["hongdae"], "shot", [300, 300, 400], [3500, 6500], 12],
];

for (const [procedureId, product, areas, unit, amounts, [low, high], count] of OTHER_GROUPS) {
  for (let i = 0; i < count; i += 1) {
    const area = pick(areas);
    const value = pick(amounts);
    // unit prices on a 100 won grid so paidKrw stays a whole number of won
    const unitKrw = Math.round(between(low, high) / 100) * 100;
    push({
      procedureId,
      product,
      area,
      amount: { value, unit },
      paidKrw: unitKrw * value,
      normalizedUnitKrw: unitKrw,
      verified: rand() < 0.85,
      date: randomDate(),
      ...sourceFields(rand() < 0.4 ? "outcome" : "shared_record", area),
    });
  }
}

// a few public offers elsewhere, reference only
for (const [procedureId, product, area, unit, value, unitKrw] of [
  ["thermage_flx", "Thermage FLX", "gangnam", "shot", 300, 2900],
  ["shrink_universe", "Shrink Universe", "hongdae", "shot", 300, 190],
  ["botox_forehead", "Botulinum toxin", "sinsa", "unit", 50, 1200],
]) {
  push({
    procedureId,
    product,
    area,
    amount: { value, unit },
    paidKrw: unitKrw * value,
    normalizedUnitKrw: unitKrw,
    verified: false,
    date: randomDate(),
    source: "public_offer",
    clinicId: CLINIC_BY_AREA[area],
  });
}

// One record per line keeps the file reviewable in diffs.
const file = new URL("../data/seed/price-records.json", import.meta.url);
writeFileSync(file, `[\n${records.map((r) => `  ${JSON.stringify(r)}`).join(",\n")}\n]\n`);
console.log(`wrote ${records.length} price records`);
