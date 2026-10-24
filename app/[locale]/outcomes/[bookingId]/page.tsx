import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/customer/page-shell";
import { routing } from "@/i18n/routing";
import { BOOKING_ID } from "@/lib/ui-data/customer";
import { peekLocale, resolveLocale } from "../../_lib/locale";
import { OutcomeForm } from "./outcome-form";

type Props = { params: Promise<{ locale: string; bookingId: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, bookingId: BOOKING_ID }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const t = await getTranslations({ locale, namespace: "outcomes" });
  return { title: `${t("metaTitle")} · Pibu` };
}

export default async function OutcomePage({ params }: Props) {
  await resolveLocale({ params });
  const { bookingId } = await params;
  if (bookingId !== BOOKING_ID) notFound();
  return (
    <PageShell>
      <OutcomeForm />
    </PageShell>
  );
}
