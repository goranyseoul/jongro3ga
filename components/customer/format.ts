import type { IsoDate, Locale } from "@/lib/domain/common";
import { APPROX_PREFIX, formatCurrency } from "@/lib/money";
import { referenceFor, type IsoDateTime } from "@/lib/ui-data/customer";

// Dates are formatted by hand, not with Intl, so the server and the browser always print the same
// text. Slot times are Korean local time (+09:00) and are shown as written.

const WEEKDAY: Record<Locale, string[]> = {
  ja: ["日", "月", "火", "水", "木", "金", "土"],
  "zh-CN": ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  ko: ["일", "월", "화", "수", "목", "금", "토"],
};

const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-14" as "11月14日(土)", "11月14日 周六", "Sat, Nov 14", "11월 14일(토)". */
export function formatDay(date: IsoDate, locale: Locale): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const weekday = WEEKDAY[locale][new Date(Date.UTC(y, m - 1, d)).getUTCDay()] as string;
  switch (locale) {
    case "ja":
      return `${m}月${d}日(${weekday})`;
    case "zh-CN":
      return `${m}月${d}日 ${weekday}`;
    case "en":
      return `${weekday}, ${MONTH_EN[m - 1]} ${d}`;
    case "ko":
      return `${m}월 ${d}일(${weekday})`;
  }
}

/** "2026-11" as "2026年11月", "2026年11月", "Nov 2026", "2026년 11월". */
export function formatMonth(month: string, locale: Locale): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  switch (locale) {
    case "ja":
    case "zh-CN":
      return `${y}年${m}月`;
    case "en":
      return `${MONTH_EN[m - 1]} ${y}`;
    case "ko":
      return `${y}년 ${m}월`;
  }
}

/** Short weekday names, Sunday first. */
export function weekdayNames(locale: Locale): string[] {
  return WEEKDAY[locale];
}

export function formatTime(dateTime: IsoDateTime): string {
  return dateTime.slice(11, 16);
}

export function formatSlot(dateTime: IsoDateTime, locale: Locale): string {
  return `${formatDay(dateTime.slice(0, 10), locale)} ${formatTime(dateTime)}`;
}

/** "11/13~11/15" for compact trip ranges. */
export function formatRange(from: IsoDate, to: IsoDate): string {
  const short = (d: IsoDate) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  return `${short(from)}~${short(to)}`;
}

// Text-only money for sentences: "₩450,000 (約 ¥49,000)". Components use <Money> instead.

export function moneyText(krw: number, locale: Locale): string {
  const reference = referenceFor(krw, locale);
  const base = formatCurrency(krw, "KRW");
  return reference ? `${base} (${APPROX_PREFIX[locale]} ${formatCurrency(reference.amount, reference.currency)})` : base;
}
