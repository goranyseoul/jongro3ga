// Display helpers and reference data for the customer web app. Customer data (profile, requests, quotes,
// bookings, records) comes from the customer BFF (app/api/customer/**); what is left here is vocabulary the
// screens share: procedure names and usual amounts for the condition card, clinic display names, money
// reference values, demo accounts of the signup screen and event copy. All people and clinics are fictional.

import type { IsoDate, Krw, Locale } from "@/lib/domain/common";
import type { ReferenceCurrency } from "@/lib/money";
import { getProcedure as getMasterProcedure } from "@/lib/domain/procedure-master";

// ---------------------------------------------------------------------------
// Shared types (06-data-model.md "공통 타입")
// ---------------------------------------------------------------------------

export type IsoDateTime = string;
export type I18nText = Partial<Record<Locale, string>>;
export type Unit = "cc" | "shot" | "unit" | "line" | "session" | "vial";
export interface Amount {
  value: number;
  unit: Unit;
}
export type AgeBand = "20-24" | "25-29" | "30-34" | "35-39" | "40+";
export type Area = "gangnam" | "sinsa" | "apgujeong" | "myeongdong" | "hongdae" | "other";
export type Concern =
  | "elasticity"
  | "fine_lines"
  | "pores"
  | "acne_scars"
  | "pigmentation"
  | "redness"
  | "dryness"
  | "contour";
export type Nationality = "JP" | "CN" | "US" | "KR" | (string & {});
export type ProcedureId =
  | "rejuran_healer"
  | "thermage_flx"
  | "ulthera"
  | "botox_forehead"
  | "shrink_universe"
  | "skin_booster_juvelook";

/** The demo clock start (lib/clock.ts DEFAULT_DEMO_NOW, BUILD-LOG 13). Screens read "today" from the BFF. */
export const DEMO_NOW: IsoDateTime = "2026-10-24T10:00:00+09:00";
export const DEMO_TODAY: IsoDate = "2026-10-24";

// ---------------------------------------------------------------------------
// Dates, money reference values
// ---------------------------------------------------------------------------

/** Date arithmetic in UTC so the result never depends on the viewer's time zone. */
export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const ms = (s: IsoDate) => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((ms(to) - ms(from)) / 86_400_000);
}

// Won per unit, fixed reference values (data/seed/fx.json in the real build).
export const FX_RATES: Record<ReferenceCurrency, number> = { JPY: 9.2, CNY: 190, USD: 1380 };

const REFERENCE_CURRENCY: Partial<Record<Locale, ReferenceCurrency>> = { ja: "JPY", "zh-CN": "CNY", en: "USD" };

/** Customer-currency reference value, two significant digits ("約 ¥37,000"). Undefined for ko. */
export function referenceFor(krw: Krw, locale: Locale): { currency: ReferenceCurrency; amount: number } | undefined {
  const currency = REFERENCE_CURRENCY[locale];
  if (!currency) return undefined;
  const raw = krw / FX_RATES[currency];
  const step = 10 ** Math.max(Math.floor(Math.log10(raw)) - 1, 0);
  return { currency, amount: Math.round(raw / step) * step };
}

// ---------------------------------------------------------------------------
// Procedure master (06-data-model.md "시술 마스터")
// ---------------------------------------------------------------------------

export interface Procedure {
  id: ProcedureId;
  name: I18nText;
  category: "injection" | "laser" | "lifting" | "skin_booster";
  products: string[];
  unit: Unit;
  concerns: Concern[];
  typicalAmount: { min: number; max: number };
  downtimeDays: { min: number; max: number };
  onsetDays: { min: number; max: number };
  cycle: {
    initial?: { count: number; intervalDays: number };
    maintenanceIntervalDays: { min: number; max: number };
  };
  dataStatus: "confirmed_by_planner" | "demo_assumption";
}

// Cycles are confirmed by the planner (PLANNING.md); amounts, downtime and onset are demo values,
// so every row is "demo_assumption" and the UI shows the "demo value" caption.
export const PROCEDURES: Procedure[] = [
  {
    id: "rejuran_healer",
    name: { ja: "リジュラン", "zh-CN": "丽珠兰", en: "Rejuran", ko: "리쥬란" },
    category: "skin_booster",
    products: ["Rejuran Healer", "Rejuran HB"],
    unit: "cc",
    concerns: ["elasticity", "fine_lines", "pores", "acne_scars"],
    typicalAmount: { min: 2, max: 3 },
    downtimeDays: { min: 1, max: 1 },
    onsetDays: { min: 14, max: 28 },
    cycle: { initial: { count: 3, intervalDays: 30 }, maintenanceIntervalDays: { min: 90, max: 120 } },
    dataStatus: "demo_assumption",
  },
  {
    id: "thermage_flx",
    name: { ja: "サーマージ", "zh-CN": "热玛吉", en: "Thermage", ko: "써마지" },
    category: "lifting",
    products: ["Thermage FLX"],
    unit: "shot",
    concerns: ["elasticity", "contour"],
    typicalAmount: { min: 600, max: 900 },
    downtimeDays: { min: 0, max: 1 },
    onsetDays: { min: 30, max: 90 },
    cycle: { maintenanceIntervalDays: { min: 300, max: 400 } },
    dataStatus: "demo_assumption",
  },
  {
    id: "ulthera",
    name: { ja: "ウルセラ", "zh-CN": "超声刀", en: "Ulthera", ko: "울쎄라" },
    category: "lifting",
    products: ["Ultherapy"],
    unit: "line",
    concerns: ["elasticity", "contour"],
    typicalAmount: { min: 300, max: 600 },
    downtimeDays: { min: 0, max: 2 },
    onsetDays: { min: 30, max: 90 },
    cycle: { maintenanceIntervalDays: { min: 300, max: 400 } },
    dataStatus: "demo_assumption",
  },
  {
    id: "botox_forehead",
    name: { ja: "ボトックス(額)", "zh-CN": "肉毒素(额头)", en: "Botox (forehead)", ko: "보톡스(이마)" },
    category: "injection",
    products: ["Botox"],
    unit: "unit",
    concerns: ["fine_lines"],
    typicalAmount: { min: 20, max: 50 },
    downtimeDays: { min: 0, max: 1 },
    onsetDays: { min: 3, max: 14 },
    cycle: { maintenanceIntervalDays: { min: 90, max: 120 } },
    dataStatus: "demo_assumption",
  },
  {
    id: "shrink_universe",
    name: { ja: "シュリンクユニバース", "zh-CN": "Shrink Universe", en: "Shrink Universe", ko: "슈링크 유니버스" },
    category: "lifting",
    products: ["Shrink Universe"],
    unit: "shot",
    concerns: ["elasticity", "pores", "contour"],
    typicalAmount: { min: 300, max: 600 },
    downtimeDays: { min: 0, max: 1 },
    onsetDays: { min: 14, max: 60 },
    cycle: { maintenanceIntervalDays: { min: 30, max: 60 } },
    dataStatus: "demo_assumption",
  },
  {
    id: "skin_booster_juvelook",
    name: { ja: "ジュベルック", "zh-CN": "Juvelook", en: "Juvelook", ko: "쥬베룩" },
    category: "skin_booster",
    products: ["Juvelook"],
    unit: "cc",
    concerns: ["fine_lines", "dryness", "acne_scars"],
    typicalAmount: { min: 2, max: 4 },
    downtimeDays: { min: 1, max: 3 },
    onsetDays: { min: 14, max: 42 },
    cycle: { initial: { count: 3, intervalDays: 30 }, maintenanceIntervalDays: { min: 180, max: 180 } },
    dataStatus: "demo_assumption",
  },
];

export function getProcedure(id: string): Procedure | undefined {
  return PROCEDURES.find((p) => p.id === id);
}

/** Master ids (data/seed/procedures.json) that are the same procedure as a product level id above. */
const MASTER_ALIAS: Record<string, ProcedureId> = {
  rejuran: "rejuran_healer",
  thermage: "thermage_flx",
  shrink: "shrink_universe",
  juvelook: "skin_booster_juvelook",
  botox_wrinkle: "botox_forehead",
};

export function procedureName(id: string, locale: Locale): string {
  const p = getProcedure(id) ?? getProcedure(MASTER_ALIAS[id] ?? "");
  if (p) return p.name[locale] ?? p.name.en ?? id;
  const master = getMasterProcedure(id);
  return master?.name[locale] ?? master?.name.en ?? master?.name.ko ?? id;
}

/** Matches a customer's free text against procedure names in every language and the id. */
export function detectProcedure(text: string): Procedure | undefined {
  const needle = text.toLowerCase();
  const aliases: Record<ProcedureId, string[]> = {
    rejuran_healer: ["rejuran", "リジュラン", "リヂュラン", "丽珠兰", "麗珠蘭", "리쥬란", "리주란"],
    thermage_flx: ["thermage", "サーマージ", "热玛吉", "熱瑪吉", "써마지"],
    ulthera: ["ulthera", "ultherapy", "ウルセラ", "超声刀", "울쎄라"],
    botox_forehead: ["botox", "ボトックス", "肉毒", "보톡스"],
    shrink_universe: ["shrink", "シュリンク", "슈링크"],
    skin_booster_juvelook: ["juvelook", "ジュベルック", "쥬베룩"],
  };
  return PROCEDURES.find((p) => aliases[p.id].some((alias) => needle.includes(alias.toLowerCase())));
}

// ---------------------------------------------------------------------------
// Records (shape of TreatmentRecord, 06; the agent computes sessions in lib/agents/customer/schedule.ts)
// ---------------------------------------------------------------------------

export type RecordStatus = "active" | "paused" | "stopped";

export interface TreatmentRecord {
  id: string;
  customerId: string;
  procedureId: ProcedureId;
  date: IsoDate;
  amount?: Amount;
  priceKrw?: Krw;
  clinicId?: string;
  clinicName?: string;
  source: "manual" | "booking" | "onboarding_history";
  receiptImage?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  note?: string;
  sessionNumber: number;
  nextDue?: IsoDate;
  status: RecordStatus;
  stopReason?: "no_effect" | "expensive" | "side_effect" | "other";
  sharedToPlatform: boolean;
}

// ---------------------------------------------------------------------------
// Clinics (names and areas of the registry, 01-users-journeys.md)
// ---------------------------------------------------------------------------

export interface ClinicRegistryEntry {
  id: string;
  slug: string;
  name: I18nText;
  area: Area;
  operationMode: "proxy" | "clinic";
  languages: { locale: Locale; mode: "staff" | "interpreter" | "app_translation" }[];
}

export interface ClinicProfile extends ClinicRegistryEntry {
  address: string;
}

export const CLINICS: ClinicProfile[] = [
  {
    id: "cln_seoul_glow",
    slug: "seoul-glow",
    name: { ja: "ソウルグロウ医院", "zh-CN": "首尔Glow诊所", en: "Seoul Glow Clinic", ko: "서울글로우의원" },
    area: "sinsa",
    operationMode: "clinic",
    languages: [
      { locale: "ja", mode: "staff" },
      { locale: "en", mode: "staff" },
    ],
    address: "서울특별시 강남구 신사동 (데모 주소)",
  },
  {
    id: "cln_mint",
    slug: "mint",
    name: { ja: "ミント皮膚科", "zh-CN": "薄荷皮肤科", en: "Mint Dermatology Clinic", ko: "민트피부과의원" },
    area: "gangnam",
    operationMode: "proxy",
    languages: [
      { locale: "ja", mode: "interpreter" },
      { locale: "en", mode: "interpreter" },
    ],
    address: "서울특별시 강남구 강남대로 (데모 주소)",
  },
  {
    id: "cln_hanbit",
    slug: "hanbit",
    name: { ja: "ハンビット医院", "zh-CN": "韩比特医院", en: "Hanbit Clinic", ko: "한빛의원" },
    area: "myeongdong",
    operationMode: "proxy",
    languages: [
      { locale: "zh-CN", mode: "staff" },
      { locale: "ja", mode: "interpreter" },
    ],
    address: "서울특별시 중구 명동 (데모 주소)",
  },
  {
    id: "cln_ara",
    slug: "ara",
    name: { ja: "アラ医院", "zh-CN": "阿拉诊所", en: "Ara Clinic", ko: "아라의원" },
    area: "apgujeong",
    operationMode: "proxy",
    languages: [{ locale: "ja", mode: "interpreter" }],
    address: "서울특별시 강남구 압구정동 (데모 주소)",
  },
  {
    id: "cln_dahye",
    slug: "dahye",
    name: { ja: "ダヘ皮膚科", "zh-CN": "多惠皮肤科", en: "Dahye Dermatology Clinic", ko: "다혜피부과의원" },
    area: "hongdae",
    operationMode: "clinic",
    languages: [{ locale: "en", mode: "staff" }],
    address: "서울특별시 마포구 홍대 (데모 주소)",
  },
];

export function getClinic(id: string): ClinicProfile | undefined {
  return CLINICS.find((c) => c.id === id);
}

export function clinicName(id: string, locale: Locale): string {
  const c = getClinic(id);
  return c?.name[locale] ?? c?.name.en ?? id;
}

// ---------------------------------------------------------------------------
// Demo accounts, quote copy, booking and outcome vocabularies
// ---------------------------------------------------------------------------

/** Demo accounts of the signup screen (05-screens.md): Yuki starts at onboarding, the rest are finished. */
export interface DemoAccount {
  id: string;
  key: "yuki" | "lin" | "emily" | "jisoo";
  displayName: string;
  locale: Locale;
  nationality: Nationality;
  start: "onboarding" | "home";
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { id: "cus_yuki", key: "yuki", displayName: "Yuki", locale: "ja", nationality: "JP", start: "onboarding" },
  { id: "cus_lin", key: "lin", displayName: "Lin", locale: "zh-CN", nationality: "CN", start: "home" },
  { id: "cus_emily", key: "emily", displayName: "Emily", locale: "en", nationality: "US", start: "home" },
  { id: "cus_jisoo", key: "jisoo", displayName: "지수", locale: "ko", nationality: "KR", start: "home" },
];

/** Localized event text; the wire event carries English strings only. */
export const EVENT_COPY: Record<string, { title: I18nText; conditions: I18nText }> = {
  "First visit 1cc event": {
    title: { ja: "初回限定 1ccイベント", "zh-CN": "首次到访限定 1cc 活动", en: "First visit 1cc event", ko: "첫 방문 1cc 이벤트" },
    conditions: { ja: "初回ご来院のみ", "zh-CN": "仅限首次到访", en: "First visit only", ko: "첫 방문 한정" },
  },
};

export type BookingStatus = "requested" | "pending_clinic" | "confirmed" | "canceled" | "no_show" | "completed";

export type ProductVerified = "vial_shown" | "packaging_shown" | "explained_verbally" | "not_checked";
