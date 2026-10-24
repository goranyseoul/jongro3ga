// Mock clinic directory for the landing and the agent's first answers. Every clinic is fictional.
// Procedures come from the procedure master (data/seed/procedures.json); the five clinics of the request
// flow keep their ids so a recommendation can lead into the quote screens.

import type { Locale } from "@/lib/domain/common";
import { procedureMaster } from "../domain/procedure-master";
import type { Procedure } from "../domain/procedure";
import type { Area, I18nText } from "./customer";

export type ProcedureArea = Procedure["areas"][number];

/** Treatment groups shown as category tiles, in display order. */
export const CATEGORY_ORDER: ProcedureArea[] = [
  "lifting",
  "hydration_glow",
  "texture_renewal",
  "pigment_tone",
  "pores_oil",
  "acne_scars",
  "wrinkles",
  "volume",
  "contouring",
  "redness",
];

export const CATEGORY_NAME: Record<ProcedureArea, I18nText> = {
  lifting: { ko: "리프팅", en: "Lifting", ja: "リフトアップ", "zh-CN": "提拉" },
  hydration_glow: { ko: "물광·보습", en: "Glow", ja: "ツヤ・保湿", "zh-CN": "水光保湿" },
  texture_renewal: { ko: "피부결·재생", en: "Boosters", ja: "肌質・再生", "zh-CN": "肤质修护" },
  pigment_tone: { ko: "톤·색소", en: "Tone", ja: "トーン・シミ", "zh-CN": "肤色色斑" },
  pores_oil: { ko: "모공·피지", en: "Pores", ja: "毛穴・皮脂", "zh-CN": "毛孔油脂" },
  acne_scars: { ko: "여드름·흉터", en: "Acne scars", ja: "ニキビ跡", "zh-CN": "痘印痘坑" },
  wrinkles: { ko: "주름", en: "Wrinkles", ja: "しわ", "zh-CN": "皱纹" },
  volume: { ko: "볼륨", en: "Volume", ja: "ボリューム", "zh-CN": "填充" },
  contouring: { ko: "윤곽", en: "Contour", ja: "輪郭", "zh-CN": "轮廓" },
  redness: { ko: "홍조", en: "Redness", ja: "赤み", "zh-CN": "泛红" },
};

// The master carries ko and en; the other two languages are display names only.
const PROCEDURE_NAME_EXTRA: Record<string, { ja: string; "zh-CN": string }> = {
  ulthera: { ja: "ウルセラ", "zh-CN": "超声刀" },
  thermage: { ja: "サーマージ", "zh-CN": "热玛吉" },
  shrink: { ja: "シュリンク", "zh-CN": "Shrink 提拉" },
  inmode: { ja: "インモード", "zh-CN": "InMode" },
  oligio: { ja: "オリジオ", "zh-CN": "Oligio" },
  thread_lift: { ja: "糸リフト", "zh-CN": "线雕提拉" },
  rejuran: { ja: "リジュラン", "zh-CN": "丽珠兰" },
  juvelook: { ja: "ジュベルック", "zh-CN": "Juvelook" },
  juvelook_eye: { ja: "ジュベルック アイ", "zh-CN": "Juvelook 眼周" },
  juvelook_volume: { ja: "ジュベルック ボリューム", "zh-CN": "Juvelook 填充" },
  skin_booster: { ja: "水光注射", "zh-CN": "水光针" },
  lituo: { ja: "リトゥオ", "zh-CN": "Lituo" },
  exosome: { ja: "エクソソーム", "zh-CN": "外泌体" },
  filler: { ja: "フィラー", "zh-CN": "玻尿酸填充" },
  sculptra: { ja: "スカルプトラ", "zh-CN": "童颜针" },
  botox_wrinkle: { ja: "ボトックス(しわ)", "zh-CN": "肉毒素(除皱)" },
  botox_square_jaw: { ja: "エラボトックス", "zh-CN": "瘦脸针" },
  skin_botox: { ja: "スキンボトックス", "zh-CN": "皮肤肉毒素" },
  contour_injection: { ja: "輪郭注射", "zh-CN": "轮廓针" },
  laser_toning: { ja: "レーザートーニング", "zh-CN": "激光美白" },
  pico_toning: { ja: "ピコトーニング", "zh-CN": "皮秒美白" },
  ipl: { ja: "IPL", "zh-CN": "IPL 光子" },
  fraxel: { ja: "フラクセル", "zh-CN": "点阵激光" },
  potenza_secret: { ja: "ポテンツァ・シークレット", "zh-CN": "Potenza 黄金微针" },
  agnes: { ja: "アグネス", "zh-CN": "Agnes" },
  vbeam: { ja: "Vビーム", "zh-CN": "V-Beam 染料激光" },
  aqua_peel: { ja: "アクアピール", "zh-CN": "小气泡清洁" },
};

export function procedureLabel(id: string, locale: Locale): string {
  const procedure = procedureMaster.find((p) => p.id === id);
  const extra = PROCEDURE_NAME_EXTRA[id];
  if (locale === "ja" || locale === "zh-CN") return extra?.[locale] ?? procedure?.name.en ?? id;
  return procedure?.name[locale] ?? procedure?.name.en ?? id;
}

export function proceduresInCategory(area: ProcedureArea): Procedure[] {
  return procedureMaster.filter((p) => p.areas.includes(area));
}

/** Matches free text against procedure names in every language and the ids. Longest name wins. */
export function findProcedure(text: string): Procedure | undefined {
  const needle = text.toLowerCase().replace(/\s+/g, "");
  const names = procedureMaster.flatMap((p) => {
    const extra = PROCEDURE_NAME_EXTRA[p.id];
    return [p.id, p.name.ko, p.name.en, extra?.ja, extra?.["zh-CN"]]
      .filter((n): n is string => Boolean(n))
      .map((n) => ({ procedure: p, name: n.toLowerCase().replace(/\s+|\(.*?\)/g, "") }));
  });
  return names
    .filter(({ name }) => name.length >= 2 && needle.includes(name))
    .sort((a, b) => b.name.length - a.name.length)[0]?.procedure;
}

// ---------------------------------------------------------------------------
// Verification standards: the same list drives the clinic cards and the public standards section
// ---------------------------------------------------------------------------

export type StandardKey =
  | "registered"
  | "namedDoctor"
  | "dermatologist"
  | "genuineProduct"
  | "priceAsQuoted"
  | "languageSupport"
  | "explainedBefore"
  | "aftercare";

export const STANDARD_ORDER: StandardKey[] = [
  "registered",
  "namedDoctor",
  "dermatologist",
  "genuineProduct",
  "priceAsQuoted",
  "languageSupport",
  "explainedBefore",
  "aftercare",
];

export const STANDARD_TEXT: Record<StandardKey, { label: I18nText; cycle: I18nText }> = {
  registered: {
    label: { ko: "외국인환자 유치기관 등록", en: "Registered for foreign patients", ja: "外国人患者誘致機関に登録", "zh-CN": "已登记为外国患者接待机构" },
    cycle: { ko: "매년", en: "Yearly", ja: "毎年", "zh-CN": "每年" },
  },
  namedDoctor: {
    label: { ko: "시술 의사 실명 공개", en: "Treating doctor named", ja: "施術医の実名公開", "zh-CN": "公开施术医生姓名" },
    cycle: { ko: "분기마다", en: "Quarterly", ja: "四半期ごと", "zh-CN": "每季度" },
  },
  dermatologist: {
    label: { ko: "피부과 전문의 진료", en: "Board-certified dermatologist", ja: "皮膚科専門医が診療", "zh-CN": "皮肤科专科医生" },
    cycle: { ko: "매년", en: "Yearly", ja: "毎年", "zh-CN": "每年" },
  },
  genuineProduct: {
    label: { ko: "정품 개봉 확인", en: "Genuine product opened in view", ja: "正規品を目の前で開封", "zh-CN": "当面开封正品" },
    cycle: { ko: "결과 기록마다", en: "Every outcome", ja: "記録ごと", "zh-CN": "每次记录" },
  },
  priceAsQuoted: {
    label: { ko: "견적대로 결제", en: "Paid as quoted", ja: "見積もりどおりの支払い", "zh-CN": "按报价付款" },
    cycle: { ko: "결과 기록마다", en: "Every outcome", ja: "記録ごと", "zh-CN": "每次记录" },
  },
  languageSupport: {
    label: { ko: "외국어 상담 상주", en: "Language staff on site", ja: "外国語スタッフ常駐", "zh-CN": "外语人员驻场" },
    cycle: { ko: "분기마다", en: "Quarterly", ja: "四半期ごと", "zh-CN": "每季度" },
  },
  explainedBefore: {
    label: { ko: "시술 전 부작용·비용 설명", en: "Risks and cost explained first", ja: "施術前に副作用と費用を説明", "zh-CN": "施术前说明副作用与费用" },
    cycle: { ko: "결과 기록마다", en: "Every outcome", ja: "記録ごと", "zh-CN": "每次记录" },
  },
  aftercare: {
    label: { ko: "시술 후 연락 창구", en: "Aftercare contact", ja: "施術後の連絡窓口", "zh-CN": "术后联络窗口" },
    cycle: { ko: "반기마다", en: "Twice a year", ja: "半年ごと", "zh-CN": "每半年" },
  },
};

// ---------------------------------------------------------------------------
// Clinics
// ---------------------------------------------------------------------------

export interface DirectoryClinic {
  id: string;
  name: I18nText;
  area: Area;
  languages: Locale[];
  operationMode: "proxy" | "clinic";
  procedures: string[];
  /** Standards the clinic currently passes. */
  passes: StandardKey[];
}

const ALL: StandardKey[] = STANDARD_ORDER;
const without = (...keys: StandardKey[]) => ALL.filter((k) => !keys.includes(k));

export const DIRECTORY: DirectoryClinic[] = [
  {
    id: "cln_seoul_glow",
    name: { ko: "서울글로우의원", en: "Seoul Glow Clinic", ja: "ソウルグロウ医院", "zh-CN": "首尔Glow诊所" },
    area: "sinsa",
    languages: ["ja", "en"],
    operationMode: "clinic",
    procedures: ["rejuran", "skin_booster", "ulthera", "thermage", "botox_wrinkle", "pico_toning"],
    passes: ALL,
  },
  {
    id: "cln_mint",
    name: { ko: "민트피부과의원", en: "Mint Dermatology Clinic", ja: "ミント皮膚科", "zh-CN": "薄荷皮肤科" },
    area: "gangnam",
    languages: ["ja", "en"],
    operationMode: "proxy",
    procedures: ["rejuran", "laser_toning", "shrink", "skin_botox", "aqua_peel"],
    passes: without("priceAsQuoted", "namedDoctor"),
  },
  {
    id: "cln_ara",
    name: { ko: "아라의원", en: "Ara Clinic", ja: "アラ医院", "zh-CN": "阿拉诊所" },
    area: "apgujeong",
    languages: ["ja"],
    operationMode: "proxy",
    procedures: ["rejuran", "thermage", "filler", "juvelook"],
    passes: without("priceAsQuoted"),
  },
  {
    id: "cln_hanbit",
    name: { ko: "한빛의원", en: "Hanbit Clinic", ja: "ハンビット医院", "zh-CN": "韩比特医院" },
    area: "myeongdong",
    languages: ["zh-CN", "ja"],
    operationMode: "proxy",
    procedures: ["rejuran", "laser_toning", "pico_toning", "ipl", "botox_square_jaw"],
    passes: without("dermatologist"),
  },
  {
    id: "cln_dahye",
    name: { ko: "다혜피부과의원", en: "Dahye Dermatology Clinic", ja: "ダヘ皮膚科", "zh-CN": "多惠皮肤科" },
    area: "hongdae",
    languages: ["en"],
    operationMode: "clinic",
    procedures: ["rejuran", "ulthera", "potenza_secret", "fraxel", "vbeam"],
    passes: ALL,
  },
  { id: "cln_lumen", name: { ko: "루멘의원", en: "Lumen Clinic" }, area: "sinsa", languages: ["en", "ja"], operationMode: "clinic", procedures: ["thermage", "ulthera", "oligio", "skin_booster"], passes: ALL },
  { id: "cln_haneul", name: { ko: "하늘피부과의원", en: "Haneul Dermatology" }, area: "apgujeong", languages: ["zh-CN", "en"], operationMode: "proxy", procedures: ["inmode", "shrink", "botox_square_jaw", "contour_injection"], passes: without("aftercare") },
  { id: "cln_dalbit", name: { ko: "달빛의원", en: "Dalbit Clinic" }, area: "gangnam", languages: ["ja"], operationMode: "proxy", procedures: ["skin_booster", "rejuran", "exosome", "lituo"], passes: without("namedDoctor") },
  { id: "cln_soo", name: { ko: "수피부과의원", en: "Soo Dermatology" }, area: "sinsa", languages: ["en"], operationMode: "clinic", procedures: ["pico_toning", "laser_toning", "ipl", "vbeam"], passes: ALL },
  { id: "cln_yeon", name: { ko: "연의원", en: "Yeon Clinic" }, area: "apgujeong", languages: ["ja", "zh-CN"], operationMode: "clinic", procedures: ["filler", "sculptra", "juvelook_volume", "thread_lift"], passes: without("priceAsQuoted") },
  { id: "cln_bom", name: { ko: "봄피부과의원", en: "Bom Dermatology" }, area: "myeongdong", languages: ["zh-CN", "ja", "en"], operationMode: "proxy", procedures: ["aqua_peel", "skin_booster", "laser_toning", "skin_botox"], passes: without("dermatologist", "aftercare") },
  { id: "cln_seum", name: { ko: "세움의원", en: "Seum Clinic" }, area: "gangnam", languages: ["en"], operationMode: "clinic", procedures: ["potenza_secret", "fraxel", "rejuran", "exosome"], passes: ALL },
  { id: "cln_ohn", name: { ko: "온피부과의원", en: "Ohn Dermatology" }, area: "sinsa", languages: ["ja"], operationMode: "clinic", procedures: ["juvelook", "juvelook_eye", "rejuran", "skin_booster"], passes: ALL },
  { id: "cln_garam", name: { ko: "가람의원", en: "Garam Clinic" }, area: "hongdae", languages: ["en", "zh-CN"], operationMode: "proxy", procedures: ["shrink", "inmode", "botox_wrinkle", "laser_toning"], passes: without("namedDoctor", "priceAsQuoted") },
  { id: "cln_noeul", name: { ko: "노을피부과의원", en: "Noeul Dermatology" }, area: "apgujeong", languages: ["ja", "en"], operationMode: "clinic", procedures: ["ulthera", "thermage", "thread_lift", "oligio"], passes: ALL },
  { id: "cln_dain", name: { ko: "다인의원", en: "Dain Clinic" }, area: "gangnam", languages: ["zh-CN"], operationMode: "proxy", procedures: ["contour_injection", "botox_square_jaw", "filler", "skin_botox"], passes: without("aftercare") },
  { id: "cln_sol", name: { ko: "솔피부과의원", en: "Sol Dermatology" }, area: "myeongdong", languages: ["zh-CN", "en"], operationMode: "clinic", procedures: ["vbeam", "ipl", "agnes", "aqua_peel"], passes: ALL },
  { id: "cln_mirae", name: { ko: "미래의원", en: "Mirae Clinic" }, area: "sinsa", languages: ["en", "ja"], operationMode: "clinic", procedures: ["agnes", "potenza_secret", "fraxel", "lituo"], passes: without("languageSupport") },
  { id: "cln_haon", name: { ko: "하온피부과의원", en: "Haon Dermatology" }, area: "hongdae", languages: ["en"], operationMode: "proxy", procedures: ["laser_toning", "pico_toning", "skin_booster"], passes: without("namedDoctor") },
  { id: "cln_raon", name: { ko: "라온의원", en: "Raon Clinic" }, area: "apgujeong", languages: ["ja", "zh-CN", "en"], operationMode: "clinic", procedures: ["exosome", "rejuran", "skin_booster", "juvelook"], passes: ALL },
  { id: "cln_binna", name: { ko: "빛나피부과의원", en: "Binna Dermatology" }, area: "gangnam", languages: ["ja"], operationMode: "proxy", procedures: ["thermage", "shrink", "inmode"], passes: without("dermatologist") },
  { id: "cln_dasom", name: { ko: "다솜의원", en: "Dasom Clinic" }, area: "myeongdong", languages: ["zh-CN"], operationMode: "clinic", procedures: ["botox_wrinkle", "skin_botox", "filler", "sculptra"], passes: ALL },
  { id: "cln_eun", name: { ko: "은피부과의원", en: "Eun Dermatology" }, area: "sinsa", languages: ["en", "zh-CN"], operationMode: "clinic", procedures: ["fraxel", "potenza_secret", "agnes", "vbeam"], passes: ALL },
  { id: "cln_jinju", name: { ko: "진주의원", en: "Jinju Clinic" }, area: "apgujeong", languages: ["ja", "en"], operationMode: "proxy", procedures: ["juvelook_eye", "juvelook_volume", "lituo", "skin_booster"], passes: without("priceAsQuoted") },
];

export function directoryClinicName(clinic: DirectoryClinic, locale: Locale): string {
  return clinic.name[locale] ?? clinic.name.en ?? clinic.id;
}

export function clinicsForProcedure(id: string): DirectoryClinic[] {
  return DIRECTORY.filter((c) => c.procedures.includes(id));
}

export function clinicsForCategory(area: ProcedureArea): DirectoryClinic[] {
  const ids = new Set(proceduresInCategory(area).map((p) => p.id));
  return DIRECTORY.filter((c) => c.procedures.some((p) => ids.has(p)));
}

export function clinicsInArea(area: Area): DirectoryClinic[] {
  return DIRECTORY.filter((c) => c.area === area);
}

/** Most standards passed first, then by id, so the order never depends on anything a clinic pays for. */
export function rankClinics(list: DirectoryClinic[]): DirectoryClinic[] {
  return [...list].sort((a, b) => b.passes.length - a.passes.length || a.id.localeCompare(b.id));
}

/** What a landing tap or a typed sentence asks the agent to show. */
export type DirectoryTopic =
  | { kind: "category"; id: ProcedureArea }
  | { kind: "procedure"; id: string }
  | { kind: "procedures"; ids: string[] }
  | { kind: "area"; id: Area }
  | { kind: "all" };

export function clinicsForTopic(topic: DirectoryTopic): DirectoryClinic[] {
  switch (topic.kind) {
    case "category":
      return rankClinics(clinicsForCategory(topic.id));
    case "procedure":
      return rankClinics(clinicsForProcedure(topic.id));
    case "procedures":
      return rankClinics(DIRECTORY.filter((c) => topic.ids.some((id) => c.procedures.includes(id))));
    case "area":
      return rankClinics(clinicsInArea(topic.id));
    case "all":
      return rankClinics(DIRECTORY);
  }
}

/** Areas that have at least one clinic, in display order. */
export const DIRECTORY_AREAS: Area[] = (["sinsa", "gangnam", "apgujeong", "myeongdong", "hongdae"] as Area[]).filter(
  (area) => clinicsInArea(area).length > 0,
);
