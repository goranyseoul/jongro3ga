import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, buttonStyles } from "@/components/ui";
import { cn } from "@/lib/cn";
import { LANDING_COPY } from "./landing-copy";
import { LOCALES, isLocale, wordBreak } from "./locales";
import { SiteFooter, SiteNav, container } from "./site-chrome";

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

function SectionHeader({ eyebrow, title, kw }: { eyebrow: string; title: string; kw: string }) {
  return (
    <div className="flex flex-col gap-sp-2">
      <p className="text-label font-med text-muted">{eyebrow}</p>
      <h2 className={cn(kw, "text-h2 font-semi")}>{title}</h2>
    </div>
  );
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const c = LANDING_COPY[locale];
  const start = `/${locale}/onboarding`;
  const kw = wordBreak(locale);

  return (
    <div lang={locale} className="flex min-h-screen flex-col">
      <SiteNav locale={locale} />

      <main className="flex-1">
        <section className={cn(container, "flex flex-col items-start gap-sp-6 py-sp-16")}>
          <h1 className="text-h1 font-semi md:text-display">{WORDMARK}</h1>
          <p className="max-w-3xl break-keep text-title font-med md:text-h2">{c.hero.title}</p>
          <p className="max-w-xl break-keep text-body text-muted md:text-title">{c.hero.body}</p>
          <Link href={start} className={buttonStyles({ size: "lg" })}>
            {c.start}
          </Link>
        </section>

        <section className="border-t border-border-soft py-sp-16">
          <div className={cn(container, "flex flex-col gap-sp-8")}>
            <SectionHeader eyebrow={c.steps.eyebrow} title={c.steps.title} kw={kw} />
            <ol className="grid grid-cols-1 gap-sp-4 md:grid-cols-3">
              {c.steps.items.map((item, index) => (
                <li key={item.title}>
                  <Card className="flex h-full flex-col gap-sp-2">
                    <span className="text-label text-subtle tabular-nums">{index + 1}</span>
                    <h3 className={cn(kw, "text-title font-semi")}>{item.title}</h3>
                    <p className={cn(kw, "text-body text-muted")}>{item.body}</p>
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-border-soft py-sp-16">
          <div className={cn(container, "flex flex-col gap-sp-8")}>
            <SectionHeader eyebrow={c.principles.eyebrow} title={c.principles.title} kw={kw} />
            <ul className="grid grid-cols-1 gap-sp-4 md:grid-cols-3">
              {c.principles.items.map((item) => (
                <li key={item.title}>
                  <Card className="flex h-full flex-col gap-sp-2">
                    <h3 className={cn(kw, "text-title font-semi")}>{item.title}</h3>
                    <p className={cn(kw, "text-body text-muted")}>{item.body}</p>
                  </Card>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border-soft py-sp-16">
          <div className={cn(container, "flex flex-col items-center gap-sp-4 text-center")}>
            <h2 className={cn(kw, "text-h2 font-semi")}>{c.closing.title}</h2>
            <p className={cn(kw, "text-body text-muted")}>{c.closing.body}</p>
            <Link href={start} className={buttonStyles({ size: "lg" })}>
              {c.start}
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} />
    </div>
  );
}
