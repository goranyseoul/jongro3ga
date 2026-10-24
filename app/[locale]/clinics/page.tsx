import { Suspense } from "react";
import type { Metadata } from "next";
import { PageShell } from "@/components/customer/page-shell";
import { routing } from "@/i18n/routing";
import { DIRECTORY } from "@/lib/ui-data/directory";
import "@/styles/explore.css";
import { peekLocale, resolveLocale } from "../_lib/locale";
import { EXPLORE_COPY } from "./_explore/copy";
import { ExploreView } from "./_explore/explore-view";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const c = EXPLORE_COPY[locale];
  return { title: `${c.metaTitle} · PibooK`, description: c.metaDescription(DIRECTORY.length) };
}

// The header is rendered on the server; the filters, the list and the map read the URL on the client,
// which is why they sit under a Suspense boundary.
export default async function ClinicsPage({ params }: Props) {
  const locale = await resolveLocale({ params });
  const c = EXPLORE_COPY[locale];

  return (
    <PageShell variant="public" width="wide">
      <header className="flex flex-col gap-sp-3">
        <h1 className="text-h2 font-semi">{c.title}</h1>
        <p className="text-body text-muted">{c.sub}</p>
        <div className="flex flex-col gap-sp-1 rounded-card border border-border-soft bg-sunken px-sp-4 py-sp-3">
          <p className="text-label font-med">{c.demoNotice}</p>
          <p className="text-caption text-muted">{c.orderNote}</p>
        </div>
      </header>
      <Suspense fallback={<div className="ex-fallback" aria-hidden="true" />}>
        <ExploreView locale={locale} />
      </Suspense>
    </PageShell>
  );
}
