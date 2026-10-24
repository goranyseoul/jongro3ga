import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LANDING_COPY } from "./landing-copy";
import { LOCALES, isLocale } from "./locales";
import { OnboardingChat } from "./onboarding/onboarding-chat";
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
        languageLabel: c.footer.languages,
        startPlain: c.startPlain,
        signup: c.signup,
        agentWindow: c.agentWindow,
        tour: c.tour,
      }}
      // rendered on the server so the agency registration number is read from the environment there
      footer={<SiteFooter locale={locale} />}
    />
  );
}
