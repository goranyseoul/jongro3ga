import type { Locale } from "./domain/common";

export type ReferenceCurrency = "JPY" | "CNY" | "USD";
export type CurrencyCode = "KRW" | ReferenceCurrency;

// Prefix for the customer-currency reference value, e.g. "約 ¥37,000"
export const APPROX_PREFIX: Record<Locale, string> = {
  ja: "約",
  "zh-CN": "约",
  en: "~",
  ko: "약",
};

export function formatCurrency(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
