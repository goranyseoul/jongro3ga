import { UNIT_TEXT, type Amount } from "@/lib/ui-data/clinic";

// Fixed to Asia/Seoul so server and browser render the same text (no hydration drift).
const SEOUL = "Asia/Seoul";

const dateParts = new Intl.DateTimeFormat("ko-KR", {
  timeZone: SEOUL,
  month: "numeric",
  day: "numeric",
  weekday: "short",
});

const timeParts = new Intl.DateTimeFormat("ko-KR", {
  timeZone: SEOUL,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function pick(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

/** "10월 27일(월)" */
export function formatDay(iso: string): string {
  const parts = dateParts.formatToParts(new Date(iso));
  return `${pick(parts, "month")}월 ${pick(parts, "day")}일(${pick(parts, "weekday")})`;
}

/** "11:00" */
export function formatTime(iso: string): string {
  const parts = timeParts.formatToParts(new Date(iso));
  return `${pick(parts, "hour")}:${pick(parts, "minute")}`;
}

/** "10월 27일(월) 11:00" */
export function formatSlot(iso: string): string {
  return `${formatDay(iso)} ${formatTime(iso)}`;
}

/** Calendar date in Seoul as "2026-10-24", for same-day comparisons. */
export function seoulDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: SEOUL });
}

/** "2cc", "300샷" */
export function formatAmount(amount: Amount): string {
  return `${amount.value}${UNIT_TEXT[amount.unit]}`;
}

/** Whole days from one calendar date to another ("2026-10-24" to "2026-10-31" is 7). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** "10월 31일" from a plain calendar date. */
export function formatDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}월 ${Number(day)}일`;
}
