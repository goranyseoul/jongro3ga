import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LOCALES, isLocale } from "../locales";
import { COPY } from "./copy";
import { OnboardingChat } from "./onboarding-chat";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: isLocale(locale) ? `${COPY[locale].title} · Pibu` : "Pibu" };
}

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // keyed so switching language from the first chip starts a fresh conversation
  return <OnboardingChat key={locale} locale={locale} />;
}
