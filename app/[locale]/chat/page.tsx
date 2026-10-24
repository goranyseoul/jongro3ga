import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { PageShell } from "@/components/customer/page-shell";
import { routing } from "@/i18n/routing";
import { peekLocale, resolveLocale } from "../_lib/locale";
import { ChatView } from "./chat-view";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  const t = await getTranslations({ locale, namespace: "chat" });
  return { title: `${t("metaTitle")} · Pibuk` };
}

export default async function ChatPage({ params }: Props) {
  await resolveLocale({ params });
  return (
    <PageShell>
      {/* useSearchParams (the ?intent= shortcut from home) needs a Suspense boundary */}
      <Suspense>
        <ChatView />
      </Suspense>
    </PageShell>
  );
}
