import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LANDING_COPY } from "./landing-copy";
import { LOCALES, isLocale } from "./locales";
import { OnboardingChat } from "./onboarding/onboarding-chat";
import { SiteFooter } from "./site-chrome";

// Hero wordmark asked for by the owner (2026-10-24). The service name in nav and footer stays Pibu.
const WORDMARK = "Beauty K-Agent";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return { title: "Pibu" };
  const c = LANDING_COPY[locale];
  return { title: `${WORDMARK} · Pibu`, description: `${c.hero.title}. ${c.hero.body}` };
}

// The landing is the onboarding chat: the hero is the empty state of the conversation.
export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = LANDING_COPY[locale];

  return (
    <OnboardingChat
      key={locale}
      locale={locale}
      intro={{
        wordmark: WORDMARK,
        title: c.hero.title,
        body: c.hero.body,
        suggestions: c.suggestions,
        suggestionsLabel: c.suggestionsLabel,
        startPlain: c.startPlain,
      }}
      // rendered on the server so the agency registration number is read from the environment there
      footer={<SiteFooter locale={locale} />}
    />
  );
}
