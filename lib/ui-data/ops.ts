import type { IsoDate, Locale } from "@/lib/domain/common";

// Mock data for the ops console (/ops) and demo controls (/demo) until the platform API exists.
// Shapes follow docs/spec/06-data-model.md (platform and shared namespaces), values follow the
// seed in the same file. Every clinic, person and number here is made up.

/** Fixed demo clock (DEMO_NOW in 09-architecture.md). Pages never call Date.now(). */
export const OPS_NOW = "2026-11-12T10:00:00+09:00";
export const OPS_TODAY: IsoDate = "2026-11-12";

/** A clinic whose lastVerifiedAt is older than this gets a warning sentence (05-screens.md). */
export const STALE_AFTER_DAYS = 30;

export type Area = "gangnam" | "sinsa" | "apgujeong" | "myeongdong" | "hongdae" | "other";
export type OperationMode = "proxy" | "clinic";
export type AgentRole = "customer" | "platform" | "clinic";

export const AREA_LABEL: Record<Area, string> = {
  gangnam: "강남",
  sinsa: "신사",
  apgujeong: "압구정",
  myeongdong: "명동",
  hongdae: "홍대",
  other: "기타",
};

export const NATIONALITY_LABEL: Record<string, string> = {
  JP: "일본",
  CN: "중국",
  US: "미국",
  KR: "한국",
};

export const LOCALE_LABEL: Record<Locale, string> = {
  ja: "일본어",
  "zh-CN": "중국어",
  en: "영어",
  ko: "한국어",
};

export const OPERATION_MODE_LABEL: Record<OperationMode, string> = {
  proxy: "대행",
  clinic: "직접",
};

const MS_PER_DAY = 86_400_000;

/** Whole days from a YYYY-MM-DD date to the demo clock's date. */
export function daysSince(date: IsoDate): number {
  return Math.round((Date.parse(OPS_TODAY) - Date.parse(date)) / MS_PER_DAY);
}

/** Whole days from the demo clock's date to a YYYY-MM-DD date. */
export function daysUntil(date: IsoDate): number {
  return -daysSince(date);
}

/** Adds days to a YYYY-MM-DD date. */
export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date(Date.parse(date) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

// Timestamps are stored with the +09:00 offset, so slicing keeps KST without time zone math.
export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function formatMonthDayTime(iso: string): string {
  return `${iso.slice(5, 7)}/${iso.slice(8, 10)} ${iso.slice(11, 16)}`;
}

export function formatClock(iso: string): string {
  return iso.slice(11, 19);
}

// ---- Clinic registry (ClinicRegistryEntry, 06-data-model.md) ----

export type VerificationStatus = "verified" | "pending_verification" | "suspended";
export type DataSource = "sms" | "public_web" | "clinic_input";
export type LanguageMode = "staff" | "interpreter" | "app_translation";

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified: "검증 완료",
  pending_verification: "확인 대기",
  suspended: "정지",
};

export const DATA_SOURCE_LABEL: Record<DataSource, string> = {
  sms: "문자",
  public_web: "공개 웹",
  clinic_input: "병원 입력",
};

export const LANGUAGE_MODE_LABEL: Record<LanguageMode, string> = {
  staff: "상주",
  interpreter: "통역",
  app_translation: "앱 번역",
};

export type OpsClinic = {
  id: string;
  name: string;
  area: Area;
  operationMode: OperationMode;
  dataSources: DataSource[];
  lastVerifiedAt: IsoDate;
  foreignPatientFacilityRegistered: boolean;
  verificationStatus: VerificationStatus;
  languages: { locale: Locale; mode: LanguageMode }[];
};

// The five seed clinics of 01-users-journeys.md. lastVerifiedAt is chosen so that two proxy
// clinics (한빛, 아라) are past the 30 day limit against the demo clock.
export const OPS_CLINICS: OpsClinic[] = [
  {
    id: "cln_seoul_glow",
    name: "서울글로우의원",
    area: "sinsa",
    operationMode: "clinic",
    dataSources: ["clinic_input"],
    lastVerifiedAt: "2026-11-05",
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified",
    languages: [
      { locale: "ja", mode: "staff" },
      { locale: "ko", mode: "staff" },
    ],
  },
  {
    id: "cln_mint",
    name: "민트피부과의원",
    area: "gangnam",
    operationMode: "proxy",
    dataSources: ["sms", "public_web"],
    lastVerifiedAt: "2026-10-20",
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified",
    languages: [
      { locale: "ja", mode: "interpreter" },
      { locale: "ko", mode: "staff" },
    ],
  },
  {
    id: "cln_hanbit",
    name: "한빛의원",
    area: "myeongdong",
    operationMode: "proxy",
    dataSources: ["sms"],
    lastVerifiedAt: "2026-09-28",
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified",
    languages: [
      { locale: "zh-CN", mode: "staff" },
      { locale: "ko", mode: "staff" },
    ],
  },
  {
    id: "cln_ara",
    name: "아라의원",
    area: "apgujeong",
    operationMode: "proxy",
    dataSources: ["sms", "public_web"],
    lastVerifiedAt: "2026-10-09",
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified",
    languages: [
      { locale: "ja", mode: "interpreter" },
      { locale: "ko", mode: "staff" },
    ],
  },
  {
    id: "cln_dahye",
    name: "다혜피부과의원",
    area: "hongdae",
    operationMode: "clinic",
    dataSources: ["clinic_input"],
    lastVerifiedAt: "2026-11-09",
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified",
    languages: [
      { locale: "en", mode: "staff" },
      { locale: "ko", mode: "staff" },
    ],
  },
];

export function clinicName(id: string): string {
  return OPS_CLINICS.find((clinic) => clinic.id === id)?.name ?? id;
}

export function isStale(clinic: OpsClinic): boolean {
  return daysSince(clinic.lastVerifiedAt) > STALE_AFTER_DAYS;
}

/** "19분 전" style elapsed time against the demo clock. */
export function formatElapsed(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(OPS_NOW) - Date.parse(iso)) / 60_000));
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}시간 전`;
  return `${Math.floor(minutes / (60 * 24))}일 전`;
}

// ---- Proxy queue: booking requests to proxy-operated clinics (clinic.book, 02-agents.md) ----

export type ProxyBookingState = "waiting_clinic" | "confirmed" | "rejected";

export const PROXY_STATE_LABEL: Record<ProxyBookingState, string> = {
  waiting_clinic: "병원 확인 대기",
  confirmed: "확정",
  rejected: "병원 거절",
};

export type ProxyBooking = {
  id: string;
  clinicId: string;
  /** What a proxy operator sees when acting as the clinic: display name and pseudonymous agent id. */
  guest: { displayName: string; agentId: string; language: Locale };
  procedure: string;
  amountText: string;
  priceKrw: number;
  vatIncluded: boolean;
  slot: string;
  requestedAt: string;
  state: ProxyBookingState;
  resolvedAt?: string;
  note?: string;
};

export const PROXY_BOOKINGS: ProxyBooking[] = [
  {
    id: "pq_201",
    clinicId: "cln_hanbit",
    guest: { displayName: "Lin W.", agentId: "cag_2m8x9", language: "zh-CN" },
    procedure: "리쥬란 힐러",
    amountText: "2cc",
    priceKrw: 420_000,
    vatIncluded: true,
    slot: "2026-11-16T14:00:00+09:00",
    requestedAt: "2026-11-12T09:41:00+09:00",
    state: "waiting_clinic",
  },
  {
    id: "pq_202",
    clinicId: "cln_mint",
    guest: { displayName: "Mika S.", agentId: "cag_4d8p7", language: "ja" },
    procedure: "리쥬란 힐러 (이벤트)",
    amountText: "1cc",
    priceKrw: 99_000,
    vatIncluded: true,
    slot: "2026-11-13T11:00:00+09:00",
    requestedAt: "2026-11-12T09:52:00+09:00",
    state: "waiting_clinic",
  },
  {
    id: "pq_203",
    clinicId: "cln_ara",
    guest: { displayName: "Aoi H.", agentId: "cag_6c3v8", language: "ja" },
    procedure: "리쥬란 힐러",
    amountText: "2cc",
    priceKrw: 300_000,
    vatIncluded: false,
    slot: "2026-11-14T15:00:00+09:00",
    requestedAt: "2026-11-11T16:40:00+09:00",
    state: "confirmed",
    resolvedAt: "2026-11-11T17:20:00+09:00",
  },
  {
    id: "pq_204",
    clinicId: "cln_hanbit",
    guest: { displayName: "Chen L.", agentId: "cag_1r9k5", language: "zh-CN" },
    procedure: "울쎄라",
    amountText: "300샷",
    priceKrw: 1_200_000,
    vatIncluded: true,
    slot: "2026-11-15T10:00:00+09:00",
    requestedAt: "2026-11-11T11:05:00+09:00",
    state: "rejected",
    resolvedAt: "2026-11-11T13:30:00+09:00",
    note: "해당 시간 예약 마감",
  },
];
