import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/customer/page-shell";
import { routing } from "@/i18n/routing";
import { peekLocale, resolveLocale } from "../_lib/locale";
import { SignupForm } from "./signup-form";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const t = await getTranslations({ locale, namespace: "signup" });
  return { title: `${t("metaTitle")} · PibooK` };
}

export default async function SignupPage({ params }: Props) {
  await resolveLocale({ params });
  const t = await getTranslations("signup");

  return (
    <PageShell variant="public">
      <header className="flex flex-col gap-sp-2">
        <h1 className="text-h2 font-semi">{t("title")}</h1>
        <p className="text-body text-muted">{t("lead")}</p>
      </header>
      <SignupForm />
    </PageShell>
  );
}
