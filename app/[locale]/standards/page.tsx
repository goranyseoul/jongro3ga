import type { Metadata } from "next";
import { Card, buttonStyles } from "@/components/ui";
import { PageShell } from "@/components/customer/page-shell";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { STANDARD_ORDER, STANDARD_TEXT } from "@/lib/ui-data/directory";
import { text } from "@/lib/ui-data/directory-profile";
import { peekLocale, resolveLocale } from "../_lib/locale";
import { STANDARDS_COPY } from "./copy";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  return { title: STANDARDS_COPY[locale].metaTitle, description: STANDARDS_COPY[locale].intro };
}

export default async function StandardsPage({ params }: Props) {
  const locale = await resolveLocale({ params });
  const copy = STANDARDS_COPY[locale];

  return (
    <PageShell variant="public">
      <header className="flex flex-col gap-sp-2">
        <h1 className="text-balance text-h1 font-semi">{copy.title}</h1>
        <p className="text-title text-muted">{copy.intro}</p>
      </header>

      <section aria-labelledby="st-principles" className="flex flex-col gap-sp-3">
        <h2 id="st-principles" className="text-title font-semi">
          {copy.principles.title}
        </h2>
        <ul className="grid grid-cols-1 gap-sp-3 md:grid-cols-3">
          {copy.principles.items.map((item) => (
            <li key={item.title}>
              <Card className="flex h-full flex-col gap-sp-2">
                <h3 className="text-body font-semi">{item.title}</h3>
                <p className="text-label text-muted">{item.body}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="st-standards" className="flex flex-col gap-sp-3">
        <div className="flex flex-col gap-sp-1">
          <h2 id="st-standards" className="text-title font-semi">
            {copy.standards.title}
          </h2>
          <p className="text-label text-muted">{copy.standards.lead}</p>
        </div>
        <Card className="py-sp-1">
          <ol className="flex flex-col divide-y divide-border-soft">
            {STANDARD_ORDER.map((key) => (
              <li key={key} className="flex flex-col gap-sp-1 py-sp-3">
                <h3 className="text-body font-semi">{text(STANDARD_TEXT[key].label, locale)}</h3>
                <p className="text-label text-muted">
                  <span className="text-subtle">{copy.standards.checks}: </span>
                  {copy.standards.items[key]}
                </p>
                <p className="text-label text-muted">
                  <span className="text-subtle">{copy.standards.cycle}: </span>
                  {text(STANDARD_TEXT[key].cycle, locale)}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <section aria-labelledby="st-failure" className="flex flex-col gap-sp-3">
        <h2 id="st-failure" className="text-title font-semi">
          {copy.failure.title}
        </h2>
        <Card>
          <ul className="flex flex-col gap-sp-2">
            {copy.failure.steps.map((step) => (
              <li key={step} className="text-body">
                {step}
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="st-cta" className="flex flex-col items-start gap-sp-3">
        <div className="flex flex-col gap-sp-1">
          <h2 id="st-cta" className="text-title font-semi">
            {copy.cta.title}
          </h2>
          <p className="text-label text-muted">{copy.cta.body}</p>
        </div>
        <Link href="/clinics" className={cn(buttonStyles({ size: "lg" }), "w-full py-sp-2 text-center sm:w-auto")}>
          {copy.cta.button}
        </Link>
      </section>

      <div role="note" className="rounded-card border border-border-soft bg-sunken p-sp-4">
        <p className="text-label text-muted">{copy.notice}</p>
      </div>
    </PageShell>
  );
}
