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
