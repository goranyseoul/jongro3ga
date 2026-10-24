import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Area, I18nText } from "../../domain/common";

// Public clinic names and areas for display and the 3 second record autocomplete. 06 lets the customer
// module read `data/seed/clinics.json` for id, name and area only (never prices or menus). Until the seed
// exists, the fictional clinics of 01-users-journeys.md are the fallback. Addresses are demo text.

export interface ClinicDirectoryEntry {
  id: string;
  name: I18nText;
  area: Area;
  address?: string;
}

const FALLBACK: ClinicDirectoryEntry[] = [
  {
    id: "cln_seoul_glow",
    name: { ja: "ソウルグロウ医院", "zh-CN": "首尔Glow诊所", en: "Seoul Glow Clinic", ko: "서울글로우의원" },
    area: "sinsa",
    address: "서울특별시 강남구 신사동 (데모 주소)",
  },
  {
    id: "cln_mint",
    name: { ja: "ミント皮膚科", "zh-CN": "薄荷皮肤科", en: "Mint Dermatology Clinic", ko: "민트피부과의원" },
    area: "gangnam",
    address: "서울특별시 강남구 강남대로 (데모 주소)",
  },
  {
    id: "cln_ara",
    name: { ja: "アラ医院", "zh-CN": "阿拉诊所", en: "Ara Clinic", ko: "아라의원" },
    area: "apgujeong",
    address: "서울특별시 강남구 압구정동 (데모 주소)",
  },
  {
    id: "cln_hanbit",
    name: { ja: "ハンビット医院", "zh-CN": "韩比特医院", en: "Hanbit Clinic", ko: "한빛의원" },
    area: "myeongdong",
    address: "서울특별시 중구 명동 (데모 주소)",
  },
  {
    id: "cln_dahye",
    name: { ja: "ダヘ皮膚科", "zh-CN": "多惠皮肤科", en: "Dahye Dermatology Clinic", ko: "다혜피부과의원" },
    area: "hongdae",
    address: "서울특별시 마포구 홍대 (데모 주소)",
  },
];

let cached: ClinicDirectoryEntry[] | undefined;

function fromSeed(): ClinicDirectoryEntry[] {
  try {
    const file = join(process.cwd(), "data", "seed", "clinics.json");
    if (!existsSync(file)) return [];
    const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
    const list = Array.isArray(raw) ? raw : Array.isArray((raw as { clinics?: unknown }).clinics) ? (raw as { clinics: unknown[] }).clinics : [];
    return list.flatMap((item) => {
      const entry = (item && typeof item === "object" && "registry" in item ? (item as { registry: unknown }).registry : item) as Record<string, unknown>;
      if (typeof entry?.id !== "string" || typeof entry.area !== "string") return [];
      const name = typeof entry.name === "string" ? { en: entry.name } : (entry.name as I18nText | undefined);
      return [{ id: entry.id, name: name ?? { en: entry.id }, area: entry.area as Area }];
    });
  } catch {
    return [];
  }
}

export function clinicDirectory(): ClinicDirectoryEntry[] {
  if (!cached) {
    const seeded = fromSeed();
    const ids = new Set(seeded.map((c) => c.id));
    // seed names win; fallback entries fill the rest and lend their demo address
    cached = [
      ...seeded.map((c) => {
        const known = FALLBACK.find((f) => f.id === c.id);
        return { ...known, ...c, name: { ...known?.name, ...c.name } };
      }),
      ...FALLBACK.filter((c) => !ids.has(c.id)),
    ];
  }
  return cached;
}

export function clinicEntry(id: string): ClinicDirectoryEntry | undefined {
  return clinicDirectory().find((c) => c.id === id);
}
