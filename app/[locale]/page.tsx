import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LANDING_COPY } from "./landing-copy";
import { LOCALES, isLocale } from "./locales";
import { LandingEntry } from "./landing-entry";
import { SiteFooter } from "./site-chrome";

// Brand wordmark, owner decision 2026-10-24 (records that move with the customer).
const WORDMARK = "PibooK";
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return { title: WORDMARK };
  const c = LANDING_COPY[locale];
  return { title: WORDMARK, description: `${c.hero.title}. ${c.hero.body}` };
}

// The landing sections; the conversation itself lives in the floating agent window (AgentDock).
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return (
    <>
      <LandingEntry locale={locale} />
      {/* rendered on the server so the agency registration number is read from the environment there */}
      <SiteFooter locale={locale} />
    </>
  );
}
