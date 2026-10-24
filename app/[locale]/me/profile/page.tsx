import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/customer/page-shell";
import { routing } from "@/i18n/routing";
import { peekLocale, resolveLocale } from "../../_lib/locale";
import { ProfileForm } from "./profile-form";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const t = await getTranslations({ locale, namespace: "me.profile" });
  return { title: `${t("metaTitle")} · PibooK` };
}

export default async function MeProfilePage({ params }: Props) {
  await resolveLocale({ params });
  return (
    <PageShell>
      <ProfileForm />
    </PageShell>
  );
}
