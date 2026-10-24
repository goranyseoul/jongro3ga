// Common types from docs/spec/06-data-model.md.
export type Locale = "ja" | "zh-CN" | "en" | "ko";
export type Nationality = "JP" | "CN" | "US" | "KR" | (string & {});
export type AgeBand = "20-24" | "25-29" | "30-34" | "35-39" | "40+";
export type Area = "gangnam" | "sinsa" | "apgujeong" | "myeongdong" | "hongdae" | "other";
/** "vial" is not in 06-data-model.md yet: the procedure table sells Juvelook and Sculptra by the vial. */
export type Unit = "cc" | "shot" | "unit" | "line" | "session" | "vial";
export type Concern =
  | "elasticity"
  | "fine_lines"
  | "pores"
  | "acne_scars"
  | "pigmentation"
  | "redness"
  | "dryness"
  | "contour";
export interface Amount {
  value: number;
  unit: Unit;
}
/** Whole won. */
export type Krw = number;
/** YYYY-MM-DD */
export type IsoDate = string;
/** ISO 8601 with offset, e.g. 2026-11-14T11:00:00+09:00 */
export type IsoDateTime = string;
export type I18nText = Partial<Record<Locale, string>>;
