import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DETAIL_COPY } from "@/components/customer/clinic-detail/copy";
import { BackLink, ClinicHeader } from "@/components/customer/clinic-detail/clinic-header";
import { ClinicFacts } from "@/components/customer/clinic-detail/clinic-facts";
import { DoctorsList } from "@/components/customer/clinic-detail/doctors-list";
import { mapsUrl } from "@/components/customer/clinic-detail/format";
import { ProcedureList } from "@/components/customer/clinic-detail/procedure-list";
import { StandardsList } from "@/components/customer/clinic-detail/standards-list";
import { PageShell } from "@/components/customer/page-shell";
import { routing } from "@/i18n/routing";
import "@/styles/clinic-detail.css";
import { STANDARD_ORDER, directoryClinicName, procedureLabel } from "@/lib/ui-data/directory";
import { DIRECTORY_PROFILES, clinicBySlug, text } from "@/lib/ui-data/directory-profile";
import { peekLocale, resolveLocale } from "../../_lib/locale";

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => DIRECTORY_PROFILES.map((profile) => ({ locale, slug: profile.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const { slug } = await params;
  const copy = DETAIL_COPY[locale];
  const found = clinicBySlug(slug);
  if (!found) return { title: copy.notFoundTitle };
  return {
    title: copy.metaTitle(directoryClinicName(found.clinic, locale)),
    description: text(found.profile.tagline, locale),
  };
}

export default async function ClinicDetailPage({ params }: Props) {
  const locale = await resolveLocale({ params });
  const { slug } = await params;
  const found = clinicBySlug(slug);
  if (!found) notFound();
  const { clinic, profile } = found;

  const common = await getTranslations("common");
  const copy = DETAIL_COPY[locale];
  const name = directoryClinicName(clinic, locale);
  const address = text(profile.address, locale);
  const signatureName = procedureLabel(profile.signature, locale);

  return (
    <PageShell variant="public" width="wide">
      <BackLink label={copy.back} />
      <ClinicHeader
        name={name}
        tagline={text(profile.tagline, locale)}
        areaName={common(`area.${clinic.area}`)}
        address={address}
        mapHref={mapsUrl(address)}
        openMapLabel={copy.openMap}
        newTabLabel={copy.opensInNewTab}
        ctaLabel={copy.cta.row}
        ctaProcedure={signatureName}
        askText={copy.askSentence(name, signatureName)}
        askTopic={{ kind: "procedure", id: profile.signature }}
      />

      <div className="grid grid-cols-1 gap-sp-8 lg:grid-cols-3 lg:items-start">
        <div className="lg:sticky lg:top-sp-6 lg:col-start-3 lg:row-start-1">
          <ClinicFacts clinic={clinic} profile={profile} copy={copy.facts} total={STANDARD_ORDER.length} />
        </div>
        <div className="flex flex-col gap-sp-8 lg:col-span-2 lg:col-start-1 lg:row-start-1">
          <ProcedureList clinic={clinic} profile={profile} clinicName={name} locale={locale} copy={copy} />
          <StandardsList clinic={clinic} profile={profile} locale={locale} copy={copy.standards} />
          <DoctorsList profile={profile} locale={locale} copy={copy.doctors} />
        </div>
      </div>

      <div role="note" className="flex flex-col gap-sp-1 rounded-card border border-border-soft bg-sunken p-sp-4">
        <p className="text-label text-muted">{copy.notice.demo}</p>
        <p className="text-label text-muted">{copy.notice.medical}</p>
      </div>
    </PageShell>
  );
}
