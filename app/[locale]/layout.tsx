import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "@/styles/customer.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();

  // The root layout fixes <html lang="ko"> for every surface, so the customer app
  // carries its own language on a wrapper element.
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <div className="cu-root" lang={locale}>
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
