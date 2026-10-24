// Mock data for the customer web app. Field names follow docs/spec/06-data-model.md and the
// pibu/*@1 wire examples in 03-a2a-protocol.md; values are the demo expectations of
// 10-build-plan.md (clock 2026-11-12, Yuki asks for Rejuran). All people and clinics are fictional.
// A backend replaces this file later; screens read through the helpers at the bottom.

import type { IsoDate, Krw, Locale } from "@/lib/domain/common";
import type { VerdictLabel } from "@/lib/domain/verdict";
import type { ReferenceCurrency } from "@/lib/money";

// ---------------------------------------------------------------------------
// Shared types (06-data-model.md "공통 타입")
// ---------------------------------------------------------------------------

export type IsoDateTime = string;
export type I18nText = Partial<Record<Locale, string>>;
export type Unit = "cc" | "shot" | "unit" | "line" | "session";
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

/**
 * One condition of a record-based offer (docs/INTEGRATION.md section 3): "records of `type` from `clinicId`,
 * made `minDays`~`maxDays` days before today, number `minCount`~`maxCount`". A missing type or clinic means any.
 */
export interface ZkClause {
  type?: string;
  clinicId?: string;
  minDays?: number;
  maxDays?: number;
  minCount?: number;
  maxCount?: number;
}

/** The demo clock (06-data-model.md "시계"): the day before Yuki arrives. */
export const DEMO_NOW: IsoDateTime = "2026-11-12T10:00:00+09:00";
export const DEMO_TODAY: IsoDate = "2026-11-12";

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

export function procedureName(id: string, locale: Locale): string {
  const p = getProcedure(id);
  return p?.name[locale] ?? p?.name.en ?? id;
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
// Schedule rules (06-data-model.md "다음 회차 계산")
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
  /** A clinic-confirmed record appended to the chain (ZK record layer). Absent: not usable for offer proofs. */
  anchor?: { subjectId: string; version: number; tx: string };
}

/** Session number of a new record: continues the previous one unless the gap is too long. */
export function nextSessionNumber(previous: TreatmentRecord | undefined, procedure: Procedure, date: IsoDate): number {
  if (!previous) return 1;
  const gap = daysBetween(previous.date, date);
  if (gap > procedure.cycle.maintenanceIntervalDays.max * 1.5) return 1;
  return previous.sessionNumber + 1;
}

export function computeNextDue(procedure: Procedure, date: IsoDate, sessionNumber: number): IsoDate {
  const { initial, maintenanceIntervalDays } = procedure.cycle;
  if (initial && sessionNumber < initial.count) return addDays(date, initial.intervalDays);
  return addDays(date, maintenanceIntervalDays.min);
}

/** Session number the customer is due for next (for "2回目: 2026-12-14"). */
export function upcomingSessionNumber(record: TreatmentRecord): number {
  return record.sessionNumber + 1;
}

/** The latest record of each procedure with the next due date, soonest first. */
export function upcomingDue(records: TreatmentRecord[]): TreatmentRecord[] {
  const latest = new Map<string, TreatmentRecord>();
  for (const r of [...records].sort((a, b) => a.date.localeCompare(b.date))) latest.set(r.procedureId, r);
  return [...latest.values()]
    .filter((r) => r.nextDue && r.status === "active")
    .sort((a, b) => (a.nextDue as string).localeCompare(b.nextDue as string));
}

/** Downtime warning (06-data-model.md): the procedure day plus the longest downtime passes the departure date. */
export function downtimeOverlapsDeparture(procedure: Procedure, slot: IsoDateTime, departure: IsoDate): boolean {
  return addDays(slot.slice(0, 10), procedure.downtimeDays.max) > departure;
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
// Customers (06-data-model.md "고객 네임스페이스", seeds of customers.json)
// ---------------------------------------------------------------------------

export interface CustomerProfile {
  id: string;
  agentId: string;
  locale: Locale;
  nickname: string;
  nationality: Nationality;
  residency?: "short_term_visitor" | "resident";
  ageBand: AgeBand;
  trip?: { arrival: IsoDate; departure: IsoDate; stayArea?: Area; flightTimeHome?: string };
  skin: { type?: "dry" | "oily" | "combination" | "sensitive" | "unknown"; concerns: Concern[] };
  safety: {
    pregnantOrBreastfeeding: boolean;
    allergies: string[];
    anticoagulants?: boolean;
    recentIsotretinoin?: boolean;
    keloidHistory?: boolean;
  };
  prefs: {
    budgetKrw?: { max: Krw };
    downtimeToleranceDays?: number;
    painTolerance?: "low" | "mid" | "high";
    languagesNeeded: Locale[];
    doctorGender?: "any" | "female";
  };
  contact: { channel: "email" | "line" | "wechat" | "whatsapp"; handle: string };
  completedAt?: IsoDateTime;
}

const noSafetyIssues = { pregnantOrBreastfeeding: false, allergies: [], anticoagulants: false, recentIsotretinoin: false, keloidHistory: false };

export const CUSTOMERS: CustomerProfile[] = [
  {
    // cus_yuki is the unfinished account (onboarding first); this is her finished profile.
    id: "cus_yuki_done",
    agentId: "cag_7f3k2",
    locale: "ja",
    nickname: "ゆき",
    nationality: "JP",
    residency: "short_term_visitor",
    ageBand: "25-29",
    trip: { arrival: "2026-11-13", departure: "2026-11-15", stayArea: "sinsa", flightTimeHome: "19:00" },
    skin: { type: "combination", concerns: ["elasticity", "fine_lines"] },
    safety: noSafetyIssues,
    prefs: { budgetKrw: { max: 450000 }, downtimeToleranceDays: 1, painTolerance: "mid", languagesNeeded: ["ja"], doctorGender: "any" },
    contact: { channel: "line", handle: "yuki_demo" },
    completedAt: "2026-11-12T09:58:00+09:00",
  },
  {
    id: "cus_lin",
    agentId: "cag_4n8vd",
    locale: "zh-CN",
    nickname: "Lin",
    nationality: "CN",
    residency: "short_term_visitor",
    ageBand: "30-34",
    trip: { arrival: "2026-12-05", departure: "2026-12-09", stayArea: "myeongdong", flightTimeHome: "17:30" },
    skin: { type: "dry", concerns: ["elasticity", "dryness"] },
    safety: noSafetyIssues,
    prefs: { budgetKrw: { max: 500000 }, downtimeToleranceDays: 3, painTolerance: "mid", languagesNeeded: ["zh-CN"], doctorGender: "any" },
    contact: { channel: "wechat", handle: "lin_demo" },
    completedAt: "2026-11-01T20:10:00+09:00",
  },
  {
    id: "cus_emily",
    agentId: "cag_2q9wk",
    locale: "en",
    nickname: "Emily",
    nationality: "US",
    residency: "short_term_visitor",
    ageBand: "25-29",
    trip: { arrival: "2026-11-20", departure: "2026-11-30", stayArea: "gangnam", flightTimeHome: "11:00" },
    skin: { type: "oily", concerns: ["pores", "acne_scars"] },
    safety: noSafetyIssues,
    prefs: { budgetKrw: { max: 600000 }, downtimeToleranceDays: 3, painTolerance: "high", languagesNeeded: ["en"], doctorGender: "any" },
    contact: { channel: "whatsapp", handle: "emily_demo" },
    completedAt: "2026-11-05T14:30:00+09:00",
  },
  {
    id: "cus_jisoo",
    agentId: "cag_8h3tb",
    locale: "ko",
    nickname: "지수",
    nationality: "KR",
    ageBand: "30-34",
    skin: { type: "combination", concerns: ["elasticity", "fine_lines"] },
    safety: noSafetyIssues,
    prefs: { languagesNeeded: ["ko"] },
    contact: { channel: "email", handle: "jisoo_demo@example.com" },
    completedAt: "2026-09-02T21:00:00+09:00",
  },
];

/** The demo account behind each locale: `/ja/...` is Yuki, `/zh-CN/...` is Lin, and so on. */
export const CUSTOMER_ID_BY_LOCALE: Record<Locale, string> = {
  ja: "cus_yuki_done",
  "zh-CN": "cus_lin",
  en: "cus_emily",
  ko: "cus_jisoo",
};

export function getCustomer(locale: Locale): CustomerProfile {
  const id = CUSTOMER_ID_BY_LOCALE[locale];
  return CUSTOMERS.find((c) => c.id === id) as CustomerProfile;
}

/** Foreign short-term visitors are the only customers who can be matched (08-compliance.md section 2). */
export function canMatch(profile: CustomerProfile): boolean {
  return profile.nationality !== "KR" && profile.residency !== "resident";
}

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

// Consent ledger (ConsentEntry) shown in settings/data.
export type ConsentType = "terms" | "privacy" | "sensitiveHealth" | "crossBorder" | "shareAnonymizedRecords" | "shareWithClinic";

export interface ConsentEntry {
  id: string;
  customerId: string;
  type: ConsentType;
  granted: boolean;
  scope: string[];
  recipientRole?: "platform" | "clinic";
  textVersion: string;
  at: IsoDateTime;
}

const CONSENT_VERSION = "2026-10-24.v1";

export function consentsFor(profile: CustomerProfile): ConsentEntry[] {
  const at = profile.completedAt ?? DEMO_NOW;
  const idBase = profile.id === "cus_yuki_done" ? 91 : 100 + CUSTOMERS.findIndex((c) => c.id === profile.id) * 10;
  const entry = (n: number, type: ConsentType, granted: boolean, scope: string[], recipientRole?: "platform" | "clinic"): ConsentEntry => ({
    id: `cns_${String(idBase + n).padStart(4, "0")}`,
    customerId: profile.id,
    type,
    granted,
    scope,
    recipientRole,
    textVersion: CONSENT_VERSION,
    at,
  });
  const entries = [
    entry(0, "terms", true, ["account.*"], "platform"),
    entry(1, "privacy", true, ["profile.*", "contact.*"], "platform"),
    entry(2, "sensitiveHealth", true, ["skin.*", "safety.*", "history.*"], "platform"),
    entry(3, "crossBorder", true, ["profile.*", "skin.*", "safety.*"], "platform"),
    entry(4, "shareAnonymizedRecords", profile.id !== "cus_emily", ["records.*"], "platform"),
  ];
  if (canMatch(profile)) {
    entries.push(entry(5, "shareWithClinic", true, ["safetyInfo.*", "contact.handle"], "clinic"));
  }
  return entries;
}

// ---------------------------------------------------------------------------
// ZK record layer (docs/INTEGRATION.md sections 2, 7): pseudonyms, chart hashes, the public ledger
// ---------------------------------------------------------------------------

export const ZK_CHAIN = {
  chainId: 84532,
  name: "Base Sepolia",
  registry: "0xcf47152e720508bf8c757a55aa30956ca8b58857",
  explorer: "https://sepolia.basescan.org",
  secondsPerDay: 60,
} as const;

/** Message extension that marks a clinic.quote carrying metadata.offerProof (INTEGRATION.md "확장 URI"). */
export const ZK_OFFER_PROOF_EXTENSION = "https://pibu.app/ext/zk-offer-proof/v1";

export const txUrl = (tx: string) => `${ZK_CHAIN.explorer}/tx/${tx}`;
export const addressUrl = (address: string) => `${ZK_CHAIN.explorer}/address/${address}`;

/** "0x1708…02b1": enough to tell hashes apart; the full value goes in a title or the export. */
export function shortHex(hex: string): string {
  return hex.length <= 12 ? hex : `${hex.slice(0, 6)}…${hex.slice(-4)}`;
}

export const YUKI_SUBJECT_ID = "0x12a4356ddc951f4c45d36db425629c955e20ec0dbebcb451b83add42ad48ebae";
const LIN_SUBJECT_ID = "0xfdb6e679db657053cd5086ccd1efeee43dcc26eeaf3c8e53c39381d5774cb878";
const LIN_COMMITMENT = "0x2af66e9d9b80b24be86fdc38f593595a6b02ac6a0d69cc461902715d5383f5cd";
const LIN_ANCHOR_TX = "0x170839896bcee7d8e491cf34b840056b1ec6f972ca7c9b5b46a11d8fc98d02b1";

/** What the device wallet knows about itself; the chart behind the commitment never leaves it. */
export interface ZkWallet {
  subjectId: string;
  /** On-chain chart hash, null while nothing is anchored (version 0). */
  commitment: string | null;
  version: number;
  anchoredRecords: number;
}

const YUKI_WALLET: ZkWallet = { subjectId: YUKI_SUBJECT_ID, commitment: null, version: 0, anchoredRecords: 0 };

/** cus_yuki and cus_yuki_done are the same person, so they share one wallet (INTEGRATION.md section 2). */
export const ZK_WALLETS: Record<string, ZkWallet> = {
  cus_yuki: YUKI_WALLET,
  cus_yuki_done: YUKI_WALLET,
  cus_lin: { subjectId: LIN_SUBJECT_ID, commitment: LIN_COMMITMENT, version: 1, anchoredRecords: 1 },
  cus_emily: {
    subjectId: "0xb7e94f8cd686d7ded4c1c0c0839f4767f62acfdd8fe59f463413fa3bafe44184",
    commitment: null,
    version: 0,
    anchoredRecords: 0,
  },
  cus_jisoo: {
    subjectId: "0x70a614435ca20ac8ada2c59f61c403d635b0bccc480c31aec3fead02a598a386",
    commitment: null,
    version: 0,
    anchoredRecords: 0,
  },
};

/**
 * The append the D0 outcome triggers (platform.anchor_record, demo scene 6). Demo values: the relayer has
 * not sent this one, so the tx does not resolve on the explorer. The ops log shows the same call.
 */
export const D0_ANCHOR = {
  tx: "0x2e04ea2daedd5ecd6b3bc81ec944de21c2526e24d4c2d9220eea7e895ecb7e4f",
  day: 29880311,
  newCommitment: "0x166ca89cd09fc29133a45e82aeaae8bbb180147532247087d5fd9f0390471772",
  recordHash: "0x08fc18865fdab450ae997e365492a1a13135208f3594db406a56779598e4e13c",
  recordNonce: "227588816530941371586866572581592759909336917924899762064909622446282245908",
  ticketCommitment: "14078410970494923729765043812108485662905772649924261547249006040536441735",
} as const;

/** The seed wallet moved forward by records this browser anchored (the D0 outcome form adds one). */
export function walletFor(customerId: string, records: TreatmentRecord[]): ZkWallet | undefined {
  const seed = ZK_WALLETS[customerId];
  if (!seed) return undefined;
  const anchored = records.filter((record) => record.anchor?.subjectId === seed.subjectId);
  const version = Math.max(seed.version, ...anchored.map((record) => record.anchor?.version ?? 0));
  return {
    ...seed,
    commitment: version > seed.version ? D0_ANCHOR.newCommitment : seed.commitment,
    version,
    anchoredRecords: Math.max(seed.anchoredRecords, anchored.length),
  };
}

/** One RecordAppended event: everything the chain holds about a record. */
export interface LedgerEvent {
  at: IsoDateTime;
  subjectId: string;
  commitment: string;
  version: number;
  tx: string;
  /** Chain day (1 day = 60 s on the demo registry), not a calendar date. */
  day: number;
}

// Every RecordAppended event of the registry as of 2026-10-24, read from Base Sepolia, newest first.
// The pseudonyms other than Lin's belong to rehearsal wallets that have been reset since.
export const LEDGER_EVENTS: LedgerEvent[] = [
  { at: "2026-10-24T14:03:49+09:00", subjectId: LIN_SUBJECT_ID, commitment: LIN_COMMITMENT, version: 1, tx: LIN_ANCHOR_TX, day: 29880303 },
  {
    at: "2026-10-24T13:35:55+09:00",
    subjectId: "0x74112ae7d152047455af46e0636d7982096c994748e73c7f3d59c4355ecc022e",
    commitment: "0x1e89f53aa81d98bced19df48e49027c2a79f1ae2663c87bed8dbd7eca63574dc",
    version: 1,
    tx: "0x2c280eb67facc3aa72db31a9ffc15a5f6f0a8a19abc7804e1904e389f2a02097",
    day: 29880275,
  },
  {
    at: "2026-10-24T13:35:52+09:00",
    subjectId: "0xf48b6ffdb8350e227091f92f20b5db1e83921cb34328547a80cc26c2e08ce4d2",
    commitment: "0x1d43ab38442f1013b9cfd19f178d1d8a3066b6c7cf9de947313146ce4b622b9b",
    version: 2,
    tx: "0xd860bcc3048d0ea779829d8f95dfb81e26afafac68beb09841f96809352f080a",
    day: 29880275,
  },
  {
    at: "2026-10-24T13:29:58+09:00",
    subjectId: "0xf48b6ffdb8350e227091f92f20b5db1e83921cb34328547a80cc26c2e08ce4d2",
    commitment: "0x2118be61626760a267c4765c2c92b7f195f322565403b83138739c63e35bab33",
    version: 1,
    tx: "0x7ee821b6599aa015ba731bf39bfb8c678284b237212b68cfafbd6e621bc19c60",
    day: 29880269,
  },
  {
    at: "2026-10-24T13:29:55+09:00",
    subjectId: "0xf1ab472d1ed7ef35a0b5073ec47b53370790b60cf50b66cffb2f7472ccf72caf",
    commitment: "0x1707883b26dfc4dc17db29e123d6b3709dd82e226418ef79dd6a459510fe5703",
    version: 1,
    tx: "0x2aade38b3f38d3129989af2005936d19ca65c42abf1e5205d251ee68c936f862",
    day: 29880269,
  },
];

// ---------------------------------------------------------------------------
// Treatment records (seed)
// ---------------------------------------------------------------------------

export const TREATMENT_RECORDS: TreatmentRecord[] = [
  // Jisoo (34, Seoul): regular Rejuran and Botox
  {
    id: "rec_jisoo_01",
    customerId: "cus_jisoo",
    procedureId: "rejuran_healer",
    date: "2026-09-14",
    amount: { value: 2, unit: "cc" },
    priceKrw: 350000,
    clinicId: "cln_seoul_glow",
    clinicName: "서울글로우의원",
    source: "manual",
    rating: 5,
    sessionNumber: 1,
    nextDue: "2026-10-14",
    status: "active",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_02",
    customerId: "cus_jisoo",
    procedureId: "rejuran_healer",
    date: "2026-10-14",
    amount: { value: 2, unit: "cc" },
    priceKrw: 350000,
    clinicId: "cln_seoul_glow",
    clinicName: "서울글로우의원",
    source: "manual",
    rating: 4,
    sessionNumber: 2,
    nextDue: "2026-11-13",
    status: "active",
    sharedToPlatform: true,
  },
  {
    id: "rec_jisoo_03",
    customerId: "cus_jisoo",
    procedureId: "botox_forehead",
    date: "2026-08-05",
    amount: { value: 50, unit: "unit" },
    priceKrw: 90000,
    clinicId: "cln_dahye",
    clinicName: "다혜피부과의원",
    source: "manual",
    sessionNumber: 1,
    nextDue: "2026-11-03",
    status: "active",
    sharedToPlatform: true,
  },
  // Lin (33, Shanghai): first Rejuran session of the course
  {
    id: "rec_lin_01",
    customerId: "cus_lin",
    procedureId: "rejuran_healer",
    date: "2026-10-31",
    amount: { value: 2, unit: "cc" },
    priceKrw: 420000,
    clinicId: "cln_hanbit",
    clinicName: "한빛의원",
    source: "booking",
    rating: 4,
    sessionNumber: 1,
    nextDue: "2026-11-30",
    status: "active",
    sharedToPlatform: false,
    anchor: { subjectId: LIN_SUBJECT_ID, version: 1, tx: LIN_ANCHOR_TX },
  },
];

export function recordsFor(customerId: string): TreatmentRecord[] {
  return TREATMENT_RECORDS.filter((r) => r.customerId === customerId);
}

// ---------------------------------------------------------------------------
// Yuki's request: shortlist, quotes, verdicts, A2A log (03-a2a-protocol.md, 07-platform-intelligence.md)
// ---------------------------------------------------------------------------

export interface ProcedureRequestV1 {
  schema: "pibu/procedure-request@1";
  requestId: string;
  customerAgentId: string;
  procedureId: ProcedureId;
  productPreference?: string;
  amount: Amount;
  budgetKrw?: { max: Krw };
  areas?: Area[];
  languages: Locale[];
  dateWindow: { from: IsoDate; to: IsoDate };
  visitorProfile: { nationality: Nationality; residency?: string; ageBand?: AgeBand; firstKProcedure?: boolean };
  notes?: string;
}

export type RequestStatus =
  | "draft"
  | "matching"
  | "quoting"
  | "judging"
  | "comparing"
  | "booking"
  | "booked"
  | "closed"
  | "failed";

export interface CustomerRequest {
  id: string;
  customerId: string;
  rawUtterance: string;
  request: ProcedureRequestV1;
  status: RequestStatus;
  matchId?: string;
  createdAt: IsoDateTime;
}

export const REQUEST_ID = "req_01J9Z8";

export const YUKI_REQUEST: CustomerRequest = {
  id: REQUEST_ID,
  customerId: "cus_yuki_done",
  rawUtterance: "リジュラン受けたい",
  request: {
    schema: "pibu/procedure-request@1",
    requestId: REQUEST_ID,
    customerAgentId: "cag_7f3k2",
    procedureId: "rejuran_healer",
    productPreference: "any",
    amount: { value: 2, unit: "cc" },
    budgetKrw: { max: 450000 },
    areas: ["sinsa", "gangnam", "apgujeong"],
    languages: ["ja"],
    dateWindow: { from: "2026-11-13", to: "2026-11-15" },
    visitorProfile: { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true },
    notes: "Prefer short downtime, flying home on 11-15 evening",
  },
  status: "comparing",
  matchId: "mt_4401",
  createdAt: "2026-11-12T10:00:00+09:00",
};

export interface ClinicShortlistV1 {
  schema: "pibu/clinic-shortlist@1";
  requestId: string;
  matchId: string;
  appliedRuleIds: string[];
  priceReference: {
    procedureId: ProcedureId;
    unit: Unit;
    region: string;
    p25UnitKrw: Krw;
    p50UnitKrw: Krw;
    p75UnitKrw: Krw;
    sampleSize: number;
    windowDays: number;
  };
  candidates: {
    clinicId: string;
    score: number;
    reasons: string[];
    /** Clinic-confirmed visits of PibooK users (visit tickets). Display only, never part of the score. */
    verifiedVisits?: number;
    /** Aggregate of verified reviews, present only when n >= 5. Review text is never shown. */
    reviewStats?: { n: number; avgRating: number };
  }[];
}

export const SHORTLIST: ClinicShortlistV1 = {
  schema: "pibu/clinic-shortlist@1",
  requestId: REQUEST_ID,
  matchId: "mt_4401",
  appliedRuleIds: [],
  priceReference: {
    procedureId: "rejuran_healer",
    unit: "cc",
    region: "gangnam_sinsa",
    p25UnitKrw: 140000,
    p50UnitKrw: 160000,
    p75UnitKrw: 185000,
    sampleSize: 42,
    windowDays: 120,
  },
  candidates: [
    {
      clinicId: "cln_seoul_glow",
      score: 0.86,
      reasons: ["Japanese-speaking coordinator on site", "Paid prices close to quotes in 18 past outcomes", "Open slots on 11-14"],
      verifiedVisits: 1240,
      reviewStats: { n: 18, avgRating: 4.6 },
    },
    {
      clinicId: "cln_ara",
      score: 0.74,
      reasons: ["Japanese interpreter available", "Same area group as your stay"],
      verifiedVisits: 640,
      reviewStats: { n: 7, avgRating: 3.9 },
    },
    {
      clinicId: "cln_mint",
      score: 0.68,
      reasons: ["Japanese interpreter available", "Open slots on 11-13"],
      verifiedVisits: 980,
      reviewStats: { n: 12, avgRating: 4.1 },
    },
  ],
};

export interface QuoteV1 {
  schema: "pibu/quote@1";
  quoteId: string;
  requestId: string;
  clinicId: string;
  procedureId: ProcedureId;
  product: string;
  amount: Amount;
  priceKrw: Krw;
  vatIncluded: boolean;
  includes: string[];
  excludes: string[];
  event?: {
    title: string;
    regularPriceKrw: Krw;
    validFrom: IsoDate;
    validUntil: IsoDate;
    /** Human readable conditions stay required even when zkClauses exist (의료법 시행령 제23조). */
    conditions: string;
    /** Set: the event applies only with a proof of these clauses. */
    zkClauses?: ZkClause[];
  };
  /** The clinic verified an offer proof and applied the event price. */
  offerApplied?: { offerId: string; verified: true };
  slots: IsoDateTime[];
  languages: Locale[];
  indicative: boolean;
  validUntil: IsoDate;
  operationMode: "proxy" | "clinic";
}

const kst = (date: string, hour: number) => `${date}T${String(hour).padStart(2, "0")}:00:00+09:00`;

const MINT_FIRST_VISIT_OFFER_ID = "ofr_mint_rejuran_first_visit";

/**
 * pibu/offer-proof@1 the customer agent attached to Mint's clinic.quote (metadata.offerProof), as the A2A
 * log stores it: proof bytes shortened. publicInputs follow the circuit order
 * [commitment, today, type, clinic, min_days, max_days, min_count, max_count]; Yuki has no anchored
 * record yet, so the commitment input is the empty chart's 0x0.
 */
export const MINT_OFFER_PROOF = {
  schema: "pibu/offer-proof@1",
  offerId: MINT_FIRST_VISIT_OFFER_ID,
  clinicId: "cln_mint",
  subjectId: YUKI_SUBJECT_ID,
  chainId: ZK_CHAIN.chainId,
  registry: ZK_CHAIN.registry,
  today: 29880272,
  proofs: [{ proof: "[proof 14.1KB]", publicInputs: ["0x0", "29880272", "0", "2", "0", "100000", "0", "0"] }],
};

export const QUOTES: QuoteV1[] = [
  {
    schema: "pibu/quote@1",
    quoteId: "qt_1203",
    requestId: REQUEST_ID,
    clinicId: "cln_seoul_glow",
    procedureId: "rejuran_healer",
    product: "Rejuran Healer",
    amount: { value: 2, unit: "cc" },
    priceKrw: 340000,
    vatIncluded: true,
    includes: ["numbing_cream", "soothing_mask"],
    excludes: [],
    slots: [
      kst("2026-11-13", 14),
      kst("2026-11-13", 15),
      kst("2026-11-14", 11),
      kst("2026-11-14", 14),
      kst("2026-11-14", 15),
      kst("2026-11-15", 10),
      kst("2026-11-15", 11),
    ],
    languages: ["ja", "en"],
    indicative: false,
    validUntil: "2026-11-20",
    operationMode: "clinic",
  },
  {
    schema: "pibu/quote@1",
    quoteId: "qt_88a1",
    requestId: REQUEST_ID,
    clinicId: "cln_mint",
    procedureId: "rejuran_healer",
    product: "Rejuran Healer",
    amount: { value: 1, unit: "cc" },
    priceKrw: 99000,
    vatIncluded: true,
    includes: ["numbing_cream"],
    excludes: ["soothing_mask"],
    event: {
      title: "First visit 1cc event",
      regularPriceKrw: 150000,
      validFrom: "2026-11-01",
      validUntil: "2026-11-30",
      conditions: "First visit only",
      zkClauses: [{ clinicId: "cln_mint", maxCount: 0 }],
    },
    offerApplied: { offerId: MINT_FIRST_VISIT_OFFER_ID, verified: true },
    slots: [kst("2026-11-13", 15), kst("2026-11-14", 11), kst("2026-11-15", 10)],
    languages: ["ja", "en"],
    indicative: true,
    validUntil: "2026-11-19",
    operationMode: "proxy",
  },
  {
    schema: "pibu/quote@1",
    quoteId: "qt_5f02",
    requestId: REQUEST_ID,
    clinicId: "cln_ara",
    procedureId: "rejuran_healer",
    product: "Rejuran Healer",
    amount: { value: 2, unit: "cc" },
    priceKrw: 300000,
    vatIncluded: false,
    includes: ["numbing_cream"],
    excludes: ["soothing_mask"],
    slots: [kst("2026-11-13", 10), kst("2026-11-13", 11), kst("2026-11-14", 14)],
    languages: ["ja"],
    indicative: true,
    validUntil: "2026-11-19",
    operationMode: "proxy",
  },
];

/** Localized event text; the wire event carries English strings only. */
export const EVENT_COPY: Record<string, { title: I18nText; conditions: I18nText }> = {
  "First visit 1cc event": {
    title: { ja: "初回限定 1ccイベント", "zh-CN": "首次到访限定 1cc 活动", en: "First visit 1cc event", ko: "첫 방문 1cc 이벤트" },
    conditions: { ja: "初回ご来院のみ", "zh-CN": "仅限首次到访", en: "First visit only", ko: "첫 방문 한정" },
  },
};

export interface FairnessVerdictV1 {
  quoteId: string;
  normalizedUnitKrw: Krw;
  priceBand: "low" | "mid" | "high" | "very_high" | "insufficient";
  doseFlag: "below_typical" | "within" | "above_typical";
  typicalAmount: { min: number; max: number; unit: Unit };
  clinicFlags: { code: "paid_more_than_quoted" | "indicative_price"; avgGapPct?: number }[];
  label: VerdictLabel;
  confidence: "high" | "medium" | "low" | "none";
  sampleSize: number;
  explanation: I18nText;
}

const typical = { min: 2, max: 3, unit: "cc" } as const;

export const VERDICTS: FairnessVerdictV1[] = [
  {
    quoteId: "qt_1203",
    normalizedUnitKrw: 170000,
    priceBand: "mid",
    doseFlag: "within",
    typicalAmount: typical,
    clinicFlags: [],
    label: "fair",
    confidence: "high",
    sampleSize: 42,
    explanation: {
      en: "The unit price is within the usual range of 42 recorded payments in the last 120 days (₩140,000~185,000 per cc), and 2cc is a usual amount.",
      ja: "単価は直近120日の記録42件の通常範囲(1ccあたり₩140,000~185,000)に収まり、2ccは通常の量です。",
      "zh-CN": "单价处于最近120天42条记录的常见区间(每cc ₩140,000~185,000),2cc 为常见用量。",
      ko: "단가가 최근 120일 기록 42건의 보통 범위(1cc당 ₩140,000~185,000) 안이고, 2cc는 보통 용량이에요.",
    },
  },
  {
    quoteId: "qt_88a1",
    normalizedUnitKrw: 99000,
    priceBand: "low",
    doseFlag: "below_typical",
    typicalAmount: typical,
    clinicFlags: [{ code: "indicative_price" }],
    label: "underdosed",
    confidence: "high",
    sampleSize: 42,
    explanation: {
      en: "1cc is below the 2~3cc Korean women in their late 20s usually receive. The unit price is low, but the total treatment is smaller.",
      ja: "1ccは、韓国の20代後半女性が通常受ける2~3ccより少ない量です。単価は安いですが、施術量も少なくなります。",
      "zh-CN": "1cc 低于韩国20多岁后半女性通常接受的 2~3cc。单价较低,但施术量也更少。",
      ko: "1cc는 한국 20대 후반 여성이 보통 받는 2~3cc보다 적어요. 단가는 낮지만 시술량도 적어요.",
    },
  },
  {
    quoteId: "qt_5f02",
    normalizedUnitKrw: 165000,
    priceBand: "mid",
    doseFlag: "within",
    typicalAmount: typical,
    clinicFlags: [{ code: "paid_more_than_quoted", avgGapPct: 15 }, { code: "indicative_price" }],
    label: "fair",
    confidence: "high",
    sampleSize: 42,
    explanation: {
      en: "With VAT added the unit price is ₩165,000, within the usual range of 42 recorded payments in the last 120 days, and 2cc is a usual amount.",
      ja: "VAT加算後の単価は₩165,000で、直近120日の記録42件の通常範囲に収まり、2ccは通常の量です。",
      "zh-CN": "加上增值税后单价为 ₩165,000,处于最近120天42条记录的常见区间,2cc 为常见用量。",
      ko: "부가세를 더한 단가는 ₩165,000으로 최근 120일 기록 42건의 보통 범위 안이고, 2cc는 보통 용량이에요.",
    },
  },
];

export function verdictFor(quoteId: string): FairnessVerdictV1 | undefined {
  return VERDICTS.find((v) => v.quoteId === quoteId);
}

export function candidateScore(clinicId: string): number {
  return SHORTLIST.candidates.find((c) => c.clinicId === clinicId)?.score ?? 0;
}

/** Total with VAT, the base of the unit price (07-platform-intelligence.md "입력 정규화"). */
export function normalizedTotal(quote: QuoteV1): Krw {
  return quote.vatIncluded ? quote.priceKrw : Math.round(quote.priceKrw * 1.1);
}

// A2A log of the request (A2ALogEntry), grouped into the lines the progress screen shows.
export interface A2ALogEntry {
  id: string;
  at: IsoDateTime;
  contextId: string;
  taskId: string;
  from: { agentId: string; role: "customer" | "platform" | "clinic" };
  to: { agentId: string; role: "customer" | "platform" | "clinic"; url: string };
  method: "SendMessage" | "GetTask" | "CancelTask";
  skillId: string;
  request: unknown;
  response: unknown;
  state: string;
  latencyMs: number;
  humanSummary: I18nText;
}

const CUSTOMER = { agentId: "cag_7f3k2", role: "customer" } as const;
const PLATFORM = { agentId: "pla_pibu", role: "platform", url: "https://pibu.example/a2a/platform/rpc" } as const;

function logEntry(args: {
  n: number;
  at: IsoDateTime;
  taskId: string;
  to: A2ALogEntry["to"];
  skillId: string;
  data: unknown;
  text: string;
  result: unknown;
  resultName: string;
  latencyMs: number;
  humanSummary: I18nText;
  referral?: boolean;
  /** Offer proof for this clinic, attached in metadata with the zk-offer-proof extension. */
  offerProof?: unknown;
}): A2ALogEntry {
  const rpcId = `rpc_${String(args.n).padStart(4, "0")}`;
  const metadata = {
    skillId: args.skillId,
    ...(args.referral ? { referralToken: "eyJhbGciOiJFUzI1NiJ9.example.signature" } : {}),
    ...(args.offerProof ? { offerProof: args.offerProof } : {}),
  };
  return {
    id: `log_${String(args.n).padStart(4, "0")}`,
    at: args.at,
    contextId: REQUEST_ID,
    taskId: args.taskId,
    from: CUSTOMER,
    to: args.to,
    method: "SendMessage",
    skillId: args.skillId,
    request: {
      jsonrpc: "2.0",
      id: rpcId,
      method: "SendMessage",
      params: {
        message: {
          messageId: `msg_c_${String(args.n).padStart(4, "0")}`,
          contextId: REQUEST_ID,
          role: "ROLE_USER",
          parts: [{ text: args.text }, { data: args.data, mediaType: "application/json" }],
          metadata,
          ...(args.offerProof ? { extensions: [ZK_OFFER_PROOF_EXTENSION] } : {}),
        },
        configuration: { acceptedOutputModes: ["application/json", "text/plain"] },
      },
    },
    response: {
      jsonrpc: "2.0",
      id: rpcId,
      result: {
        task: {
          id: args.taskId,
          contextId: REQUEST_ID,
          status: { state: "TASK_STATE_COMPLETED", timestamp: args.at },
          artifacts: [
            { artifactId: `art_${args.taskId}`, name: args.resultName, parts: [{ data: args.result, mediaType: "application/json" }] },
          ],
        },
      },
    },
    state: "TASK_STATE_COMPLETED",
    latencyMs: args.latencyMs,
    humanSummary: args.humanSummary,
  };
}

const quoteRequestData = {
  schema: "pibu/procedure-request@1",
  requestId: REQUEST_ID,
  customerAgentId: "cag_7f3k2",
  procedureId: "rejuran_healer",
  amount: { value: 2, unit: "cc" },
  areas: ["sinsa", "gangnam", "apgujeong"],
  languages: ["ja"],
  dateWindow: { from: "2026-11-13", to: "2026-11-15" },
  visitorProfile: { nationality: "JP", firstKProcedure: true },
};

export const A2A_LOG: A2ALogEntry[] = [
  logEntry({
    n: 1,
    at: "2026-11-12T10:00:01+09:00",
    taskId: "tsk_pl_0001",
    to: PLATFORM,
    skillId: "platform.match_clinics",
    text: "Find clinics for Rejuran Healer 2cc, 11-13~11-15, Japanese support.",
    data: YUKI_REQUEST.request,
    result: SHORTLIST,
    resultName: "clinic-shortlist",
    latencyMs: 420,
    humanSummary: {
      ja: "プラットフォームに、条件に合うクリニックを聞きました",
      "zh-CN": "已向平台询问符合条件的诊所",
      en: "I asked the platform which clinics match your conditions",
      ko: "플랫폼에 맞는 병원을 물어봤어요",
    },
  }),
  ...QUOTES.map((quote, i) =>
    logEntry({
      n: 3 + i,
      at: `2026-11-12T10:00:0${2 + i}+09:00`,
      taskId: `tsk_k${i + 1}_0001`,
      to: {
        agentId: `cla_${quote.clinicId.slice(4)}`,
        role: "clinic",
        url: `https://pibu.example/a2a/clinics/${getClinic(quote.clinicId)?.slug}/rpc`,
      },
      skillId: "clinic.quote",
      text: "Quote request for Rejuran Healer 2cc, 11-13~11-15, Japanese support.",
      data: quoteRequestData,
      result: quote,
      resultName: "quote",
      latencyMs: 900 + i * 350,
      humanSummary: {
        ja: `${clinicName(quote.clinicId, "ja")}に見積もりを依頼しました`,
        "zh-CN": `已向${clinicName(quote.clinicId, "zh-CN")}请求报价`,
        en: `I asked ${clinicName(quote.clinicId, "en")} for a quote`,
        ko: `${clinicName(quote.clinicId, "ko")}에 견적을 요청했어요`,
      },
      referral: true,
      // only the clinic whose offer matched on the device gets a proof (INTEGRATION.md section 4)
      offerProof: quote.clinicId === MINT_OFFER_PROOF.clinicId ? MINT_OFFER_PROOF : undefined,
    }),
  ),
  logEntry({
    n: 6,
    at: "2026-11-12T10:00:05+09:00",
    taskId: "tsk_pl_0002",
    to: PLATFORM,
    skillId: "platform.judge_quote",
    text: "Judge these 3 quotes.",
    data: {
      schema: "pibu/judge-request@1",
      requestId: REQUEST_ID,
      matchId: "mt_4401",
      quotes: QUOTES.map((q) => ({
        quoteId: q.quoteId,
        clinicId: q.clinicId,
        procedureId: q.procedureId,
        amount: q.amount,
        priceKrw: q.priceKrw,
        vatIncluded: q.vatIncluded,
        includes: q.includes,
      })),
    },
    result: { schema: "pibu/fairness-verdict-list@1", requestId: REQUEST_ID, verdicts: VERDICTS },
    resultName: "fairness-verdict-list",
    latencyMs: 310,
    humanSummary: {
      ja: "プラットフォームが価格を確認しました",
      "zh-CN": "平台已审核价格",
      en: "The platform reviewed the prices",
      ko: "플랫폼이 가격을 검토했어요",
    },
  }),
];

/**
 * The lines of the progress timeline (05-screens.md): match, the on-device offer proof (ZK record layer),
 * quotes, judge. The proof step has no call of its own: matching runs on the device, and the proof rides on
 * Mint's clinic.quote, which is the entry behind it.
 */
export interface ProgressStep {
  id: string;
  at: IsoDateTime;
  humanSummary: I18nText;
  detail: I18nText;
  entries: A2ALogEntry[];
}

const clinicList = (locale: Locale) => QUOTES.map((q) => clinicName(q.clinicId, locale)).join(" · ");

export const PROGRESS_STEPS: ProgressStep[] = [
  {
    id: "step_match",
    at: "2026-11-12T10:00:01+09:00",
    humanSummary: A2A_LOG[0]!.humanSummary,
    detail: {
      ja: "エリアと言語の条件に合う3院が見つかりました",
      "zh-CN": "找到3家符合地区与语言条件的诊所",
      en: "3 clinics matched your area and language",
      ko: "지역과 언어 조건에 맞는 병원 3곳을 찾았어요",
    },
    entries: [A2A_LOG[0]!],
  },
  {
    id: "step_offer_proof",
    at: "2026-11-12T10:00:02+09:00",
    humanSummary: {
      ja: "端末の中で特典の条件を確かめ、ミントに初回来院の証明を添えました",
      "zh-CN": "已在设备内核对优惠条件,并向薄荷附上首次到访证明",
      en: "I checked offer conditions on your device and attached a first-visit proof for Mint",
      ko: "기기 안에서 혜택 조건을 확인하고 민트에 첫 방문 증명을 붙였어요",
    },
    detail: {
      ja: "施術の履歴は送りません。条件を満たしているという証明だけが届きます",
      "zh-CN": "不会发送施术记录,只发送满足条件的证明",
      en: "Your treatment history is not sent. Only a proof that you meet the condition goes out",
      ko: "시술 이력은 보내지 않아요. 조건을 만족한다는 증명만 가요",
    },
    entries: [A2A_LOG[1 + QUOTES.findIndex((quote) => quote.clinicId === MINT_OFFER_PROOF.clinicId)]!],
  },
  {
    id: "step_quote",
    at: "2026-11-12T10:00:02+09:00",
    humanSummary: {
      ja: "クリニック3院に見積もりを依頼しました",
      "zh-CN": "已向3家诊所请求报价",
      en: "I asked 3 clinics for quotes",
      ko: "병원 3곳에 견적을 요청했어요",
    },
    detail: {
      ja: clinicList("ja"),
      "zh-CN": clinicList("zh-CN"),
      en: clinicList("en"),
      ko: clinicList("ko"),
    },
    entries: A2A_LOG.slice(1, 4),
  },
  {
    id: "step_judge",
    at: "2026-11-12T10:00:05+09:00",
    humanSummary: A2A_LOG[4]!.humanSummary,
    detail: {
      ja: "直近120日の支払い記録42件と比べました",
      "zh-CN": "已与最近120天的42条支付记录比较",
      en: "Compared with 42 payment records from the last 120 days",
      ko: "최근 120일 결제 기록 42건과 비교했어요",
    },
    entries: [A2A_LOG[4]!],
  },
];

// ---------------------------------------------------------------------------
// Booking and outcome (bookings/[id], outcomes/[bookingId])
// ---------------------------------------------------------------------------

export type BookingStatus = "requested" | "pending_clinic" | "confirmed" | "canceled" | "no_show" | "completed";

export interface BookingV1 {
  schema: "pibu/booking@1";
  bookingId: string;
  requestId: string;
  quoteId: string;
  clinicId: string;
  customerAgentId: string;
  slot: IsoDateTime;
  status: BookingStatus;
  confirmedBy?: "clinic_staff" | "pibu_operator" | "auto";
  priceKrw: Krw;
  instructions: I18nText;
}

export const BOOKING_ID = "bkg_5521";

/** Pre-visit instructions sent by the clinic with the confirmation. */
export const BOOKING_INSTRUCTIONS: I18nText = {
  ja: "当日はノーメイクでお越しください。",
  "zh-CN": "当天请素颜前来。",
  en: "Please come without makeup.",
  ko: "당일에는 화장하지 않고 와 주세요.",
};

export function buildBooking(args: { quoteId: string; slot: IsoDateTime; status: BookingStatus }): BookingV1 {
  const quote = QUOTES.find((q) => q.quoteId === args.quoteId) ?? (QUOTES[0] as QuoteV1);
  return {
    schema: "pibu/booking@1",
    bookingId: BOOKING_ID,
    requestId: REQUEST_ID,
    quoteId: quote.quoteId,
    clinicId: quote.clinicId,
    customerAgentId: "cag_7f3k2",
    slot: args.slot,
    status: args.status,
    confirmedBy: args.status === "confirmed" ? (quote.operationMode === "clinic" ? "clinic_staff" : "pibu_operator") : undefined,
    priceKrw: quote.priceKrw,
    instructions: BOOKING_INSTRUCTIONS,
  };
}

/** Booking the demo shows when the screen is opened directly: Seoul Glow, 11-14 11:00, waiting for the clinic. */
export const DEFAULT_BOOKING_CHOICE = { quoteId: "qt_1203", slot: kst("2026-11-14", 11) };

export type ProductVerified = "vial_shown" | "packaging_shown" | "explained_verbally" | "not_checked";

export interface OutcomeV1 {
  schema: "pibu/outcome@1";
  outcomeId: string;
  bookingId: string;
  clinicId: string;
  procedureId: ProcedureId;
  checkpoint: "D0" | "D7" | "D30";
  paidKrw: Krw;
  receivedAmount: Amount;
  productVerified: ProductVerified;
  receiptAttached: boolean;
  satisfaction: 1 | 2 | 3 | 4 | 5;
  painScore: 1 | 2 | 3 | 4 | 5;
  downtimeDaysActual: number | null;
  wouldReturn: boolean | null;
  sideEffects: string[];
  comment?: string;
  submittedAt: IsoDateTime;
}

/** What the D0 form starts with: the booked quote, so a customer only corrects what differs. */
export const OUTCOME_DEFAULTS = {
  paidKrw: 340000,
  receivedAmount: { value: 2, unit: "cc" } as Amount,
  productVerified: "vial_shown" as ProductVerified,
  satisfaction: 5 as const,
  painScore: 3 as const,
};

/** Demo clock position of D0: the procedure day after the clinic's hours (10-build-plan.md scene 6). */
export const D0_NOW: IsoDateTime = "2026-11-14T13:00:00+09:00";
