import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/customer/page-shell";
import { peekLocale, resolveLocale } from "../../_lib/locale";
import { OutcomeForm } from "./outcome-form";

type Props = {
  params: Promise<{ locale: string; bookingId: string }>;
  searchParams: Promise<{ checkin?: string; checkpoint?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const t = await getTranslations({ locale, namespace: "outcomes" });
  return { title: `${t("metaTitle")} · PibooK` };
}

export default async function OutcomePage({ params, searchParams }: Props) {
  await resolveLocale({ params });
  const { bookingId } = await params;
  const { checkin, checkpoint } = await searchParams;
  // D7 and D30 check-ins open this screen from the inbox with the item id
  const checkpointValue = checkpoint === "D7" || checkpoint === "D30" ? checkpoint : undefined;
  return (
    <PageShell>
      <OutcomeForm bookingId={bookingId} checkinId={checkin} checkpoint={checkpointValue} />
    </PageShell>
  );
}
