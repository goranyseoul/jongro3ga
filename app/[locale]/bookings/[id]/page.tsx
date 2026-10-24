import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/customer/page-shell";
import { routing } from "@/i18n/routing";
import { BOOKING_ID } from "@/lib/ui-data/customer";
import { peekLocale, resolveLocale } from "../../_lib/locale";
import { BookingView } from "./booking-view";

type Props = { params: Promise<{ locale: string; id: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: BOOKING_ID }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const t = await getTranslations({ locale, namespace: "bookings" });
  return { title: `${t("metaTitle")} · PibooK` };
}

export default async function BookingPage({ params }: Props) {
  await resolveLocale({ params });
  const { id } = await params;
  if (id !== BOOKING_ID) notFound();
  return (
    <PageShell>
      <BookingView />
    </PageShell>
  );
}
