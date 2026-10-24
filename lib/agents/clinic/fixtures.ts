// Clinic seed values from docs/spec/06-data-model.md "시드 파일" (clinics.json, slots.json rows) and
// 01-users-journeys.md (operation modes). All clinics, people and numbers are fictional.
// Used by tests and as the demo fallback until data/seed/clinics.json lands (track A2A core).
import type { ClinicProfile, MenuItem, Slot } from "../../domain/clinic";
import type { ClinicOperation, StoredOffer, StoredSlotPolicy } from "./store";

export interface ClinicSeed {
  profile: ClinicProfile;
  operation: ClinicOperation;
  menu: MenuItem[];
  offers: StoredOffer[];
  slotPolicy: StoredSlotPolicy;
}

const HOURS: StoredSlotPolicy["hours"] = {
  mon: { open: "10:00", close: "19:00" },
  tue: { open: "10:00", close: "19:00" },
  wed: { open: "10:00", close: "19:00" },
  thu: { open: "10:00", close: "19:00" },
  fri: { open: "10:00", close: "19:00" },
  sat: { open: "10:00", close: "16:00" },
  sun: null,
};

function policy(clinicId: string, autoConfirm: boolean): StoredSlotPolicy {
  return {
    id: clinicId,
    clinicId,
    durationMinByProcedure: { rejuran_healer: 60, skin_botox: 30, shurink_universe: 60, ulthera: 90 },
    foreignSlotsPerDay: 4,
    autoConfirm,
    hours: HOURS,
  };
}

function profile(
  id: string,
  slug: string,
  name: ClinicProfile["name"],
  area: ClinicProfile["area"],
  languages: ClinicProfile["languages"],
  operationMode: ClinicProfile["operationMode"],
  n: number,
): ClinicProfile {
  return {
    id,
    slug,
    name,
    address: `서울특별시 가상구 데모로 ${n} (가상 주소)`,
    area,
    medicalInstitutionId: `DEMO-MI-${String(n).padStart(4, "0")}`,
    businessRegistrationNo: `000-00-0000${n}`,
    foreignPatientFacilityRegNo: `DEMO-FP-${String(n).padStart(4, "0")}`,
    doctors: [{ name: `데모 원장 ${n}`, boardCertifiedDermatology: true, yearsOfPractice: 8 + n }],
    languages,
    operationMode,
  };
}

const rejuran = (clinicId: string, value: number, priceKrw: number, vatIncluded: boolean, includes: string[]): MenuItem => ({
  id: `mi_${clinicId.slice(4)}_rejuran_${value}cc`,
  clinicId,
  procedureId: "rejuran_healer",
  product: "Rejuran Healer",
  amount: { value, unit: "cc" },
  priceKrw,
  vatIncluded,
  includes,
  foreignerSamePrice: true,
});

export const CLINIC_SEED: ClinicSeed[] = [
  {
    profile: profile(
      "cln_seoul_glow",
      "seoul-glow",
      { ko: "서울글로우의원", en: "Seoul Glow Clinic", ja: "ソウルグロウ医院" },
      "sinsa",
      [
        { locale: "ja", mode: "staff" },
        { locale: "en", mode: "staff" },
      ],
      "clinic",
      1,
    ),
    operation: { id: "cln_seoul_glow", mode: "clinic", dataSources: ["clinic_input"], lastVerifiedAt: "2026-10-22", foreignPatientFacilityRegistered: true },
    menu: [
      rejuran("cln_seoul_glow", 2, 340000, true, ["numbing_cream", "soothing_mask"]),
      {
        id: "mi_seoul_glow_skin_botox",
        clinicId: "cln_seoul_glow",
        procedureId: "skin_botox",
        product: "Skin Botox",
        amount: { value: 40, unit: "unit" },
        priceKrw: 180000,
        vatIncluded: true,
        includes: ["numbing_cream"],
        foreignerSamePrice: true,
      },
      {
        id: "mi_seoul_glow_shurink",
        clinicId: "cln_seoul_glow",
        procedureId: "shurink_universe",
        product: "Shurink Universe",
        amount: { value: 300, unit: "shot" },
        priceKrw: 420000,
        vatIncluded: true,
        includes: ["soothing_mask"],
        foreignerSamePrice: true,
      },
      {
        id: "mi_seoul_glow_ulthera",
        clinicId: "cln_seoul_glow",
        procedureId: "ulthera",
        product: "Ulthera",
        amount: { value: 300, unit: "shot" },
        priceKrw: 890000,
        vatIncluded: false,
        includes: ["numbing_cream", "soothing_mask"],
        foreignerSamePrice: true,
      },
    ],
    offers: [
      {
        id: "of_seoul_glow_shurink_nov",
        clinicId: "cln_seoul_glow",
        procedureId: "shurink_universe",
        title: "11월 슈링크 300샷 이벤트",
        amount: { value: 300, unit: "shot" },
        priceKrw: 380000,
        regularPriceKrw: 420000,
        validFrom: "2026-11-01",
        validUntil: "2026-11-30",
        conditions: "평일 오전 예약 한정",
        active: true,
      },
    ],
    slotPolicy: policy("cln_seoul_glow", false),
  },
  {
    profile: profile(
      "cln_mint",
      "mint",
      { ko: "민트피부과의원", en: "Mint Dermatology Clinic", ja: "ミント皮膚科医院" },
      "gangnam",
      [
        { locale: "ja", mode: "interpreter" },
        { locale: "en", mode: "staff" },
      ],
      "proxy",
      2,
    ),
    operation: { id: "cln_mint", mode: "proxy", dataSources: ["sms", "public_web"], lastVerifiedAt: "2026-10-20", foreignPatientFacilityRegistered: true },
    // 06: Mint advertises the 1cc event only. The regular 1cc price is the event's regular price.
    menu: [rejuran("cln_mint", 1, 150000, true, ["numbing_cream"])],
    offers: [
      {
        id: "of_mint_rejuran_first",
        clinicId: "cln_mint",
        procedureId: "rejuran_healer",
        title: "First visit 1cc event",
        amount: { value: 1, unit: "cc" },
        priceKrw: 99000,
        regularPriceKrw: 150000,
        validFrom: "2026-11-01",
        validUntil: "2026-11-30",
        conditions: "First visit only",
        active: true,
      },
    ],
    slotPolicy: policy("cln_mint", false),
  },
  {
    profile: profile(
      "cln_ara",
      "ara",
      { ko: "아라의원", en: "Ara Clinic", ja: "アラ医院" },
      "apgujeong",
      [
        { locale: "ja", mode: "interpreter" },
        { locale: "en", mode: "interpreter" },
      ],
      "proxy",
      3,
    ),
    operation: { id: "cln_ara", mode: "proxy", dataSources: ["sms", "public_web"], lastVerifiedAt: "2026-10-18", foreignPatientFacilityRegistered: true },
    menu: [rejuran("cln_ara", 2, 300000, false, ["numbing_cream"])],
    offers: [],
    slotPolicy: policy("cln_ara", false),
  },
  {
    profile: profile(
      "cln_hanbit",
      "hanbit",
      { ko: "한빛의원", en: "Hanbit Clinic", "zh-CN": "韩光医院" },
      "myeongdong",
      [
        { locale: "zh-CN", mode: "staff" },
        { locale: "en", mode: "interpreter" },
      ],
      "proxy",
      4,
    ),
    operation: { id: "cln_hanbit", mode: "proxy", dataSources: ["sms", "public_web"], lastVerifiedAt: "2026-10-15", foreignPatientFacilityRegistered: true },
    menu: [rejuran("cln_hanbit", 2, 420000, true, ["numbing_cream", "soothing_mask"])],
    offers: [],
    slotPolicy: policy("cln_hanbit", false),
  },
  {
    profile: profile(
      "cln_dahye",
      "dahye",
      { ko: "다혜피부과의원", en: "Dahye Dermatology Clinic" },
      "hongdae",
      [{ locale: "en", mode: "staff" }],
      "clinic",
      5,
    ),
    operation: { id: "cln_dahye", mode: "clinic", dataSources: ["clinic_input"], lastVerifiedAt: "2026-10-21", foreignPatientFacilityRegistered: true },
    menu: [rejuran("cln_dahye", 2, 360000, true, ["numbing_cream"])],
    offers: [],
    slotPolicy: policy("cln_dahye", false),
  },
];

/** 06 slots.json: 2026-11-10 to 2026-11-30, every clinic, daily 10:00 · 11:00 · 14:00 · 15:00 KST. */
export function seedSlots(clinicId: string, from = "2026-11-10", to = "2026-11-30"): Slot[] {
  const slots: Slot[] = [];
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let day = start; day <= end; day += 86_400_000) {
    const date = new Date(day).toISOString().slice(0, 10);
    for (const hour of ["10", "11", "14", "15"]) {
      slots.push({
        id: `slot_${clinicId.slice(4)}_${date.replace(/-/g, "")}_${hour}`,
        clinicId,
        start: `${date}T${hour}:00:00+09:00`,
        procedureIds: [],
        held: false,
      });
    }
  }
  return slots;
}
