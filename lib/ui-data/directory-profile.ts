// Profile details of the mock clinic directory: address, map position, doctors, signature procedure,
// starting prices, when each standard was last checked, and a one-line introduction. All values are
// generated from the clinic's place in DIRECTORY, so they are stable across renders and fictional.

import type { IsoDate, Locale } from "@/lib/domain/common";
import { procedureMaster } from "../domain/procedure-master";
import type { Area, I18nText } from "./customer";
import { DIRECTORY, STANDARD_ORDER, type DirectoryClinic, type StandardKey } from "./directory";

export interface DirectoryDoctor {
  name: I18nText;
  title: I18nText;
  boardCertifiedDermatology: boolean;
  years: number;
}

export interface DirectoryVerification {
  key: StandardKey;
  checkedAt: IsoDate;
  evidence: I18nText;
}

export interface DirectoryProfile {
  id: string;
  /** URL segment of /[locale]/clinics/[slug]. */
  slug: string;
  address: I18nText;
  lat: number;
  lng: number;
  doctors: DirectoryDoctor[];
  /** Procedure id the clinic is best known for. */
  signature: string;
  /** Starting price in won (VAT included) for each procedure the clinic offers. */
  priceFromKrw: Record<string, number>;
  verifications: DirectoryVerification[];
  tagline: I18nText;
  femaleDoctor: boolean;
  listedSince: number;
}

// Neighbourhood centres; each clinic sits a short, fixed offset away from its centre.
const AREA_CENTER: Record<Area, { lat: number; lng: number; ko: string; en: string; ja: string; "zh-CN": string }> = {
  sinsa: { lat: 37.5207, lng: 127.0226, ko: "서울 강남구 신사동", en: "Sinsa-dong, Gangnam-gu, Seoul", ja: "ソウル 江南区 新沙洞", "zh-CN": "首尔 江南区 新沙洞" },
  gangnam: { lat: 37.4989, lng: 127.0277, ko: "서울 강남구 역삼동", en: "Yeoksam-dong, Gangnam-gu, Seoul", ja: "ソウル 江南区 駅三洞", "zh-CN": "首尔 江南区 驿三洞" },
  apgujeong: { lat: 37.5271, lng: 127.0405, ko: "서울 강남구 압구정동", en: "Apgujeong-dong, Gangnam-gu, Seoul", ja: "ソウル 江南区 狎鴎亭洞", "zh-CN": "首尔 江南区 狎鸥亭洞" },
  myeongdong: { lat: 37.5636, lng: 126.9827, ko: "서울 중구 명동", en: "Myeong-dong, Jung-gu, Seoul", ja: "ソウル 中区 明洞", "zh-CN": "首尔 中区 明洞" },
  hongdae: { lat: 37.5563, lng: 126.9236, ko: "서울 마포구 서교동", en: "Seogyo-dong, Mapo-gu, Seoul", ja: "ソウル 麻浦区 西橋洞", "zh-CN": "首尔 麻浦区 西桥洞" },
  other: { lat: 37.5326, lng: 127.0246, ko: "서울", en: "Seoul", ja: "ソウル", "zh-CN": "首尔" },
};

// Fictional doctors, assembled from common syllables; none refers to a real person.
const FAMILY = [
  { ko: "한", en: "Han" },
  { ko: "서", en: "Seo" },
  { ko: "윤", en: "Yoon" },
  { ko: "정", en: "Jung" },
  { ko: "강", en: "Kang" },
  { ko: "조", en: "Cho" },
  { ko: "임", en: "Lim" },
  { ko: "오", en: "Oh" },
];
const GIVEN = [
  { ko: "다은", en: "Da-eun" },
  { ko: "지후", en: "Ji-hoo" },
  { ko: "서연", en: "Seo-yeon" },
  { ko: "도윤", en: "Do-yoon" },
  { ko: "하린", en: "Ha-rin" },
  { ko: "시우", en: "Si-woo" },
  { ko: "예린", en: "Ye-rin" },
  { ko: "주원", en: "Ju-won" },
  { ko: "수아", en: "Su-a" },
  { ko: "은호", en: "Eun-ho" },
];

const TITLE_DIRECTOR: I18nText = { ko: "대표원장", en: "Medical director", ja: "院長", "zh-CN": "院长" };
const TITLE_DOCTOR: I18nText = { ko: "원장", en: "Physician", ja: "医師", "zh-CN": "医生" };

const EVIDENCE: Record<StandardKey, I18nText> = {
  registered: {
    ko: "외국인환자 유치기관 등록증 번호를 등록 기관 명부와 대조했어요",
    en: "Registration number matched against the official register",
    ja: "外国人患者誘致機関の登録番号を公的名簿と照合しました",
    "zh-CN": "已将登记号与官方名录核对",
  },
  namedDoctor: {
    ko: "시술 동의서에 시술 의사 이름이 적히는지 확인했어요",
    en: "Consent forms name the treating doctor",
    ja: "同意書に施術医の名前が記載されることを確認しました",
    "zh-CN": "已确认同意书写明施术医生姓名",
  },
  dermatologist: {
    ko: "피부과 전문의 자격을 면허 기록과 대조했어요",
    en: "Dermatology board certification checked against license records",
    ja: "皮膚科専門医の資格を免許記録と照合しました",
    "zh-CN": "已将皮肤科专科资格与执照记录核对",
  },
  genuineProduct: {
    ko: "고객 결과 기록에서 정품 개봉 확인 비율을 봤어요",
    en: "Outcome records show the product opened in front of the patient",
    ja: "記録で、正規品を目の前で開封した割合を確認しました",
    "zh-CN": "从结果记录确认当面开封正品的比例",
  },
  priceAsQuoted: {
    ko: "견적과 실제 결제액의 차이를 결과 기록으로 확인했어요",
    en: "Quote and paid amount compared in outcome records",
    ja: "見積もりと実際の支払額の差を記録で確認しました",
    "zh-CN": "通过结果记录核对报价与实际付款的差额",
  },
  languageSupport: {
    ko: "외국어 상담 인력의 근무 시간을 확인했어요",
    en: "Working hours of language staff confirmed",
    ja: "外国語スタッフの勤務時間を確認しました",
    "zh-CN": "已确认外语人员的工作时间",
  },
  explainedBefore: {
    ko: "시술 전 설명서에 부작용과 비용이 들어 있는지 확인했어요",
    en: "Pre-procedure sheet covers side effects and cost",
    ja: "施術前の説明書に副作用と費用が含まれることを確認しました",
    "zh-CN": "已确认术前说明包含副作用与费用",
  },
  aftercare: {
    ko: "시술 후 연락 창구로 실제 연락이 닿는지 확인했어요",
    en: "Aftercare contact answered a test call",
    ja: "施術後の連絡窓口に実際につながることを確認しました",
    "zh-CN": "已确认术后联络窗口可以联系上",
  },
};

const TAGLINES: I18nText[] = [
  { ko: "기록으로 맞춰 가는 꾸준한 관리", en: "Steady care, tuned by your records", ja: "記録に合わせて続けるケア", "zh-CN": "按记录持续调整的护理" },
  { ko: "짧은 일정에 맞춘 다운타임 적은 시술", en: "Low-downtime care for short trips", ja: "短い日程に合わせたダウンタイムの少ない施術", "zh-CN": "适合短途行程的低恢复期项目" },
  { ko: "리프팅을 회차로 나눠 이어가는 곳", en: "Lifting planned across visits", ja: "回数を分けて続けるリフトアップ", "zh-CN": "分次进行的提拉护理" },
  { ko: "피부결과 톤을 차근차근", en: "Texture and tone, one step at a time", ja: "肌質とトーンを少しずつ", "zh-CN": "循序渐进改善肤质与肤色" },
  { ko: "처음 받는 분을 위한 자세한 설명", en: "Careful explanations for first-timers", ja: "はじめての方へ丁寧な説明", "zh-CN": "为第一次体验的您详细说明" },
  { ko: "여러 언어로 상담하는 피부 관리", en: "Skin care consulted in your language", ja: "多言語で相談できる肌ケア", "zh-CN": "多语种咨询的皮肤护理" },
];

const pad = (n: number) => String(n).padStart(2, "0");

function priceFor(procedureId: string, index: number): number {
  const base = procedureMaster.find((p) => p.id === procedureId)?.priceKrw?.min ?? 100000;
  // a fixed spread of 90%~130% of the master's lower price, rounded to 10,000 won
  const factor = 0.9 + ((index * 7 + procedureId.length * 3) % 9) * 0.05;
  return Math.round((base * factor) / 10000) * 10000;
}

function buildProfile(clinic: DirectoryClinic, index: number): DirectoryProfile {
  const center = AREA_CENTER[clinic.area];
  const angle = (index * 137.5 * Math.PI) / 180;
  const radius = 0.0025 + (index % 4) * 0.0012;
  const doctorCount = 1 + (index % 3 === 0 ? 2 : 1);
  const doctors: DirectoryDoctor[] = Array.from({ length: doctorCount }, (_, d) => {
    const family = FAMILY[(index + d * 3) % FAMILY.length]!;
    const given = GIVEN[(index * 3 + d * 5) % GIVEN.length]!;
    return {
      name: { ko: `${family.ko}${given.ko}`, en: `${given.en} ${family.en}`, ja: `${family.en} ${given.en}`, "zh-CN": `${given.en} ${family.en}` },
      title: d === 0 ? TITLE_DIRECTOR : TITLE_DOCTOR,
      boardCertifiedDermatology: clinic.passes.includes("dermatologist") || d > 0,
      years: 6 + ((index * 5 + d * 4) % 17),
    };
  });
  const verifications = STANDARD_ORDER.filter((key) => clinic.passes.includes(key)).map((key, k) => ({
    key,
    checkedAt: `2026-${pad(4 + ((index + k) % 6))}-${pad(1 + ((index * 3 + k * 7) % 27))}`,
    evidence: EVIDENCE[key],
  }));
  return {
    id: clinic.id,
    slug: clinic.id.replace(/^cln_/, "").replace(/_/g, "-"),
    address: { ko: `${center.ko} (데모 주소)`, en: `${center.en} (demo address)`, ja: `${center.ja}(デモ住所)`, "zh-CN": `${center["zh-CN"]}(演示地址)` },
    lat: Number((center.lat + Math.sin(angle) * radius).toFixed(5)),
    lng: Number((center.lng + Math.cos(angle) * radius).toFixed(5)),
    doctors,
    signature: clinic.procedures[0] ?? "rejuran",
    priceFromKrw: Object.fromEntries(clinic.procedures.map((id) => [id, priceFor(id, index)])),
    verifications,
    tagline: TAGLINES[index % TAGLINES.length]!,
    femaleDoctor: index % 2 === 1,
    listedSince: 2024 + (index % 3),
  };
}

export const DIRECTORY_PROFILES: DirectoryProfile[] = DIRECTORY.map(buildProfile);

export function profileFor(id: string): DirectoryProfile | undefined {
  return DIRECTORY_PROFILES.find((p) => p.id === id);
}

export function clinicBySlug(slug: string): { clinic: DirectoryClinic; profile: DirectoryProfile } | undefined {
  const profile = DIRECTORY_PROFILES.find((p) => p.slug === slug);
  const clinic = profile ? DIRECTORY.find((c) => c.id === profile.id) : undefined;
  return clinic && profile ? { clinic, profile } : undefined;
}

export function text(value: I18nText, locale: Locale): string {
  return value[locale] ?? value.en ?? value.ko ?? "";
}
