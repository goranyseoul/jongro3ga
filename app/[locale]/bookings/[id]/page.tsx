import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/customer/page-shell";
import { peekLocale, resolveLocale } from "../../_lib/locale";
import { BookingView } from "./booking-view";

type Props = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const t = await getTranslations({ locale, namespace: "bookings" });
  return { title: `${t("metaTitle")} · PibooK` };
}

export default async function BookingPage({ params }: Props) {
  await resolveLocale({ params });
  const { id } = await params;
  return (
    <PageShell>
      <BookingView id={id} />
    </PageShell>
  );
}
