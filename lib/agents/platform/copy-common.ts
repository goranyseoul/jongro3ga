import type { Area, Locale, Unit } from "../../domain";

// Shared pieces of the platform's template sentences (fairness-copy.ts, matching-copy.ts). No LLM writes these.

export const LOCALES: readonly Locale[] = ["ko", "ja", "en", "zh-CN"];

/**
 * Clinic to clinic comparison is advertising the Medical Act forbids (08-compliance.md 3절, art. 56(2)4).
 * Templates may compare a price with market records, never one clinic with another. Tests scan every
 * template and every produced sentence with these.
 */
export const BANNED_COMPARISONS: readonly RegExp[] = [/より良い/, /better than/i, /보다 낫/, /比.*更好/];

export const hasBannedComparison = (text: string): boolean => BANNED_COMPARISONS.some((re) => re.test(text));

/** Replaces {name} placeholders. */
export function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in vars ? String(vars[key]) : `{${key}}`));
}

const UNIT_LABEL: Record<Unit, Record<Locale, string>> = {
  cc: { ko: "cc", ja: "cc", en: "cc", "zh-CN": "cc" },
  shot: { ko: "샷", ja: "ショット", en: " shots", "zh-CN": "发" },
  unit: { ko: "유닛", ja: "ユニット", en: " units", "zh-CN": "单位" },
  line: { ko: "라인", ja: "ライン", en: " lines", "zh-CN": "线" },
  session: { ko: "회", ja: "回", en: " sessions", "zh-CN": "次" },
  vial: { ko: "바이알", ja: "バイアル", en: " vials", "zh-CN": "瓶" },
};

export const unitLabel = (unit: Unit, locale: Locale): string => UNIT_LABEL[unit][locale];

export const formatAmount = (value: number, unit: Unit, locale: Locale): string => `${value}${unitLabel(unit, locale)}`;

export const formatRange = (min: number, max: number, unit: Unit, locale: Locale): string =>
  min === max ? formatAmount(min, unit, locale) : `${min}~${max}${unitLabel(unit, locale)}`;

export const LANGUAGE_NAME: Record<Locale, Record<Locale, string>> = {
  ja: { ko: "일본어", ja: "日本語", en: "Japanese", "zh-CN": "日语" },
  "zh-CN": { ko: "중국어", ja: "中国語", en: "Chinese", "zh-CN": "中文" },
  en: { ko: "영어", ja: "英語", en: "English", "zh-CN": "英语" },
  ko: { ko: "한국어", ja: "韓国語", en: "Korean", "zh-CN": "韩语" },
};

export const AREA_NAME: Record<Area, Record<Locale, string>> = {
  gangnam: { ko: "강남", ja: "江南", en: "Gangnam", "zh-CN": "江南" },
  sinsa: { ko: "신사", ja: "新沙", en: "Sinsa", "zh-CN": "新沙" },
  apgujeong: { ko: "압구정", ja: "狎鴎亭", en: "Apgujeong", "zh-CN": "狎鸥亭" },
  myeongdong: { ko: "명동", ja: "明洞", en: "Myeongdong", "zh-CN": "明洞" },
  hongdae: { ko: "홍대", ja: "弘大", en: "Hongdae", "zh-CN": "弘大" },
  other: { ko: "서울", ja: "ソウル", en: "Seoul", "zh-CN": "首尔" },
};
