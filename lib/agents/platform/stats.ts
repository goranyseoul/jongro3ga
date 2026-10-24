import type { Area } from "../../domain";

// Small pure helpers shared by fairness, matching, outcomes and the proposer.

export const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 07 "분위수 (선형 보간)", read as h = (n - 1) p over the sorted values (BUILD-LOG 20 (1)). */
export function quantile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

export const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;

export const clamp = (value: number, min = 0, max = 1): number => Math.min(max, Math.max(min, value));

/** Rounds to the nearest 0.5 (07 통상 용량). */
export const roundHalf = (value: number): number => Math.round(value * 2) / 2;

export const round = (value: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

/** The Korean calendar date of a time, YYYY-MM-DD. */
export const kstDate = (at: Date): string => new Date(at.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);

/** ISO 8601 with the +09:00 offset the data model uses, e.g. 2026-11-12T10:00:00+09:00. */
export const kstIso = (ms: number): string => `${new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 19)}+09:00`;

/** True when `at` (ISO date time) is at most `days` days before `now` and not after it. Boundary included. */
export function withinDays(at: string, now: Date, days: number): boolean {
  const t = Date.parse(at);
  return t >= now.getTime() - days * DAY_MS && t <= now.getTime();
}

/** True when the calendar date `date` is at most `days` days before today (KST) and not after it. */
export function dateWithinDays(date: string, now: Date, days: number): boolean {
  return date >= kstDate(new Date(now.getTime() - days * DAY_MS)) && date <= kstDate(now);
}

/** 07 1절 지역 그룹. */
export type RegionGroup = "gangnam_sinsa" | "myeongdong" | "hongdae" | "other";

export function regionGroupOf(area: Area): RegionGroup {
  if (area === "gangnam" || area === "sinsa" || area === "apgujeong") return "gangnam_sinsa";
  if (area === "myeongdong" || area === "hongdae") return area;
  return "other";
}

/** Total in won with VAT, 07 1절 입력 정규화 1. */
export const normalizedTotalKrw = (priceKrw: number, vatIncluded: boolean): number =>
  vatIncluded ? priceKrw : Math.round(priceKrw * 1.1);
