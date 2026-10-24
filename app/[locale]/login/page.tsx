import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/customer/page-shell";
import { routing } from "@/i18n/routing";
import { peekLocale, resolveLocale } from "../_lib/locale";
import { LoginForm } from "./login-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const t = await getTranslations({ locale, namespace: "account.login" });
  return { title: `${t("metaTitle")} · PibooK` };
}

export default async function LoginPage({ params, searchParams }: Props) {
  await resolveLocale({ params });
  const t = await getTranslations("account.login");
  const { next } = await searchParams;

  return (
    <PageShell variant="public">
      <div className="mx-auto flex w-full max-w-md flex-col gap-sp-8">
        <header className="flex flex-col gap-sp-2">
          <h1 className="text-h2 font-semi">{t("title")}</h1>
          <p className="text-body text-muted">{t("lead")}</p>
        </header>
        <LoginForm next={typeof next === "string" ? next : undefined} />
      </div>
    </PageShell>
  );
}
