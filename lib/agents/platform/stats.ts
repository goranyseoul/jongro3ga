// Small numeric helpers shared by fairness and matching. Pure.

/** Quantile with linear interpolation between closest ranks (the "type 7" rule, 07 "분위수"). */
export function quantile(values: readonly number[], p: number): number {
  if (values.length === 0) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const h = (sorted.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

/** Rounds to the nearest 0.5 (07 "통상 용량"). */
export const roundHalf = (x: number): number => Math.round(x * 2) / 2;

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

export function mean(values: readonly number[]): number {
  return values.length === 0 ? Number.NaN : values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Rounds to `digits` decimals without float noise (scores, ratios). */
export const roundTo = (x: number, digits: number): number => {
  const f = 10 ** digits;
  return Math.round((x + Number.EPSILON) * f) / f;
};

const DAY_MS = 86_400_000;

/** YYYY-MM-DD minus `days` calendar days. */
export function daysBefore(isoDate: string, days: number): string {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) - days * DAY_MS).toISOString().slice(0, 10);
}

/** The KST calendar date of an ISO 8601 timestamp or date. */
export function kstDate(isoDateTime: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDateTime)) return isoDateTime;
  return new Date(Date.parse(isoDateTime) + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
