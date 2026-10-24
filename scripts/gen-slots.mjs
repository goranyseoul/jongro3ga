// Generates data/seed/slots.json (06-data-model.md seed table): 2026-11-10 .. 2026-11-30, every clinic,
// every day at 10:00, 11:00, 14:00 and 15:00 KST, all free. A slot accepts every procedure the clinic sells:
// its menu items plus its offers (Mint sells Rejuran only through its first visit event).
// Usage: node scripts/gen-slots.mjs   (rewrites the file; the output is committed)
import { readFileSync, writeFileSync } from "node:fs";

const SEED_DIR = new URL("../data/seed/", import.meta.url);
const clinics = JSON.parse(readFileSync(new URL("clinics.json", SEED_DIR), "utf8"));

const FIRST_DAY = "2026-11-10";
const DAYS = 21;
const TIMES = ["10:00", "11:00", "14:00", "15:00"];

function addDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const slots = [];
for (const clinic of clinics.registry) {
  const procedureIds = [
    ...new Set([
      ...clinics.menus.filter((m) => m.clinicId === clinic.id).map((m) => m.procedureId),
      ...clinics.offers.filter((o) => o.clinicId === clinic.id).map((o) => o.procedureId),
    ]),
  ].sort();
  const short = clinic.id.replace(/^cln_/, "");
  for (let day = 0; day < DAYS; day += 1) {
    const date = addDays(FIRST_DAY, day);
    for (const time of TIMES) {
      slots.push({
        id: `slot_${short}_${date.replaceAll("-", "")}_${time.replace(":", "")}`,
        clinicId: clinic.id,
        start: `${date}T${time}:00+09:00`,
        procedureIds,
        held: false,
      });
    }
  }
}

// One slot per line keeps the file reviewable in diffs.
writeFileSync(new URL("slots.json", SEED_DIR), `[\n${slots.map((s) => `  ${JSON.stringify(s)}`).join(",\n")}\n]\n`);
console.log(`wrote ${slots.length} slots`);
