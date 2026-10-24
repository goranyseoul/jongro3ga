import { defineRouting } from "next-intl/routing";
import { LOCALES } from "@/app/[locale]/locales";

// Locale list lives next to the pages (app/[locale]/locales.ts); no proxy, so only
// /[locale]/... is localized and shared routes such as / and /ui-kit stay untouched.
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "en",
  localePrefix: "always",
});
