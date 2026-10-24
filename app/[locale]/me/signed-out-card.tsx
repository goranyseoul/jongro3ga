"use client";

import { useLocale, useTranslations } from "next-intl";
import { buttonStyles, Card } from "@/components/ui";
import { Link } from "@/i18n/navigation";

/**
 * What /me shows before a session exists. useSession() is null on the server and on the first client
 * render, so this renders instead of a redirect and the signed-in view swaps in right after hydration.
 */
export function SignedOutCard({ next }: { next: "/me" | "/me/profile" }) {
  const t = useTranslations("me.signedOut");
  const locale = useLocale();

  return (
    <Card className="flex flex-col gap-sp-4 sm:max-w-md">
      <div className="flex flex-col gap-sp-1">
        <h1 className="text-title font-semi">{t("title")}</h1>
        <p className="text-body text-muted">{t("body")}</p>
      </div>
      <Link
        href={{ pathname: "/login", query: { next: `/${locale}${next}` } }}
        className={buttonStyles({ variant: "primary" })}
      >
        {t("login")}
      </Link>
    </Card>
  );
}
