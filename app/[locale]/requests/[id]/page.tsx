import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/customer/page-shell";
import { routing } from "@/i18n/routing";
import { REQUEST_ID } from "@/lib/ui-data/customer";
import { peekLocale, resolveLocale } from "../../_lib/locale";
import { RequestView } from "./request-view";

type Props = { params: Promise<{ locale: string; id: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: REQUEST_ID }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const t = await getTranslations({ locale, namespace: "requests" });
  return { title: `${t("metaTitle")} · Pibuk` };
}

export default async function RequestPage({ params }: Props) {
  await resolveLocale({ params });
  const { id } = await params;
  // The mock store holds one request; a backend would look the id up
  if (id !== REQUEST_ID) notFound();
  return (
    <PageShell width="wide">
      <RequestView />
    </PageShell>
  );
}
