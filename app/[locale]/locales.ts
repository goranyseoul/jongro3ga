import type { Locale } from "@/lib/domain/common";

export const LOCALES: Locale[] = ["ja", "zh-CN", "en", "ko"];

export function isLocale(value: string): value is Locale {
  return (LOCALES as string[]).includes(value);
}

// Native names, the same in every locale so a customer can always find their own language.
export const LOCALE_NAME: Record<Locale, string> = {
  ja: "日本語",
  "zh-CN": "中文",
  en: "English",
  ko: "한국어",
};
