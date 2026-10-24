import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { buttonStyles, Card } from "@/components/ui";
import { PageShell } from "@/components/customer/page-shell";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { peekLocale, resolveLocale } from "./_lib/locale";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const t = await getTranslations({ locale, namespace: "landing" });
  return { title: `${t("metaTitle")} · Pibu`, description: t("metaDescription") };
}

const STEP_KEYS = ["tell", "compare", "book"] as const;
const CARE_KEYS = ["consent", "doctor", "records"] as const;

// 05-screens.md: no clinic names, prices or reviews here (08-compliance.md section 3).
export default async function LandingPage({ params }: Props) {
  await resolveLocale({ params });
  const t = await getTranslations("landing");

  return (
    <PageShell variant="public">
      <section className="flex flex-col items-start gap-sp-4 py-sp-8">
        <h1 className="text-balance text-h2 font-semi sm:text-h1">{t("title")}</h1>
        <p className="max-w-xl text-title text-muted">{t("lead")}</p>
        <Link href="/signup" className={buttonStyles({ size: "lg" })}>
          {t("start")}
        </Link>
      </section>

      <section aria-labelledby="landing-steps" className="flex flex-col gap-sp-3">
        <h2 id="landing-steps" className="text-title font-semi">
          {t("stepsTitle")}
        </h2>
        <ol className="grid grid-cols-1 gap-sp-3 md:grid-cols-3">
          {STEP_KEYS.map((key, index) => (
            <li key={key}>
              <Card className="flex h-full flex-col gap-sp-2">
                <span className="text-label tabular-nums text-subtle">{index + 1}</span>
                <h3 className="text-title font-semi">{t(`steps.${key}.title`)}</h3>
                <p className="text-body text-muted">{t(`steps.${key}.body`)}</p>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="landing-care" className="flex flex-col gap-sp-3">
        <h2 id="landing-care" className="text-title font-semi">
          {t("careTitle")}
        </h2>
        <ul className="flex flex-col gap-sp-2">
          {CARE_KEYS.map((key) => (
            <li key={key} className="text-body text-muted">
              {t(`care.${key}`)}
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  );
}
