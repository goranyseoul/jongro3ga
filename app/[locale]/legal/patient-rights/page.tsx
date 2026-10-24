import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/customer/page-shell";
import { buttonStyles } from "@/components/ui";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/cn";
import { peekLocale, resolveLocale } from "../../_lib/locale";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const t = await getTranslations({ locale, namespace: "legal" });
  return { title: `${t("metaTitle")} · Pibu` };
}

const SECTIONS = [
  { key: "service", items: ["content", "noMedical", "price", "explain", "fee", "eligibility"] },
  { key: "dispute", items: ["contact", "mediation", "records"] },
  { key: "privacy", items: ["collected", "purpose", "sensitive", "crossBorder", "retention", "rights", "anonymous"] },
] as const;

// 08-compliance.md section 1: the notice must exist in English; other languages sit beside it.
export default async function PatientRightsPage({ params }: Props) {
  const locale = await resolveLocale({ params });
  const regNo = process.env.FOREIGN_PATIENT_AGENCY_REG_NO;
  const current = await getTranslations({ locale, namespace: "legal" });
  const english = await getTranslations({ locale: "en", namespace: "legal" });

  return (
    <PageShell variant="public">
      <article className="flex flex-col gap-sp-6">
        <Notice t={current} regNo={regNo} primary />
        {locale !== "en" ? (
          <div lang="en" className="flex flex-col gap-sp-6 border-t border-border-soft pt-sp-6">
            <p className="text-label text-muted">{current("english")}</p>
            <Notice t={english} regNo={regNo} />
          </div>
        ) : null}
        <Link href="/settings/data" className={cn(buttonStyles({ variant: "secondary" }), "self-start")}>
          {current("rightsLink")}
        </Link>
      </article>
    </PageShell>
  );
}

type Translate = Awaited<ReturnType<typeof getTranslations<"legal">>>;

function Notice({ t, regNo, primary = false }: { t: Translate; regNo: string | undefined; primary?: boolean }) {
  // the English copy below the local text is a second document: its headings sit one level lower
  const Title = primary ? "h1" : "h2";
  const Section = primary ? "h2" : "h3";
  return (
    <div className="flex flex-col gap-sp-6">
      <header className="flex flex-col gap-sp-2">
        <Title className="text-h2 font-semi">{t("title")}</Title>
        <p className="text-body text-muted">{t("lead")}</p>
        <p className="text-label text-muted">
          {t("reg.label")}: <span className="tabular-nums">{regNo ? regNo : t("reg.demo")}</span>
        </p>
        <p className="text-caption text-subtle">{t("demoNotice")}</p>
      </header>
      {SECTIONS.map((section) => (
        <section key={section.key} className="flex flex-col gap-sp-3">
          <Section className="text-title font-semi">{t(`${section.key}.title`)}</Section>
          <ul className="flex flex-col gap-sp-3">
            {section.items.map((item) => (
              <li key={item} className="text-body text-muted">
                {t(`${section.key}.${item}`)}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
