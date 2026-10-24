import type { IsoDate, Locale } from "@/lib/domain/common";

// Dates are formatted by hand, not with Intl, so the server and the browser print the same text.
const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-05-12" as "May 12, 2026", "2026年5月12日", "2026년 5월 12일". */
export function formatDate(date: IsoDate, locale: Locale): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  switch (locale) {
    case "en":
      return `${MONTH_EN[m - 1]} ${d}, ${y}`;
    case "ja":
    case "zh-CN":
      return `${y}年${m}月${d}日`;
    case "ko":
      return `${y}년 ${m}월 ${d}일`;
  }
}

/** Google Maps search link for a postal-style address; a trailing note in brackets is dropped. */
export function mapsUrl(address: string): string {
  const query = address.replace(/\s*[(（][^)）]*[)）]\s*$/, "");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
