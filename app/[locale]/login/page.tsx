import type { Metadata } from "next";
import { PageShell } from "@/components/customer/page-shell";
import { authCopy } from "@/components/auth/copy";
import { routing } from "@/i18n/routing";
import { peekLocale, resolveLocale } from "../_lib/locale";
import { LoginForm } from "./login-form";

type Props = { params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await peekLocale({ params });
  return { title: `${authCopy(locale).loginTitle} · PibooK` };
}

// Email + password log in. proxy.ts sends signed-out clinic staff and operators here (/ko/login?next=...).
export default async function LoginPage({ params }: Props) {
  const locale = await resolveLocale({ params });
  const ui = authCopy(locale);

  return (
    <PageShell variant="public">
      <header className="flex flex-col gap-sp-2">
        <h1 className="text-h2 font-semi">{ui.loginTitle}</h1>
        <p className="text-body text-muted">{ui.loginLead}</p>
      </header>
      <LoginForm />
    </PageShell>
  );
}
