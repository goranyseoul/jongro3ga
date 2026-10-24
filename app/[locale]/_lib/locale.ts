import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { Locale } from "@/lib/domain/common";
import { routing } from "@/i18n/routing";

type LocaleParams = { params: Promise<{ locale: string }> };

/** Validates the [locale] segment and tells next-intl which locale this request renders in. */
export async function resolveLocale({ params }: LocaleParams): Promise<Locale> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}

/** Locale without side effects, for generateMetadata. */
export async function peekLocale({ params }: LocaleParams): Promise<Locale> {
  const { locale } = await params;
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}
