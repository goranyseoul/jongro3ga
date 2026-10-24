import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { AppNav } from "./app-nav";
import { LocaleSwitcher } from "./locale-switcher";

export type PageShellProps = {
  children: ReactNode;
  /** app: signed-in screens with the tab bar. public: landing, signup, legal with a footer. */
  variant?: "app" | "public";
  /** wide: comparison screens that need more than a phone column. */
  width?: "narrow" | "wide";
};

const widthClass = { narrow: "max-w-3xl", wide: "max-w-6xl" } as const;

export async function PageShell({ children, variant = "app", width = "narrow" }: PageShellProps) {
  const t = await getTranslations("common");
  const locale = await getLocale();
  const isApp = variant === "app";

  return (
    <>
      <header className="border-b border-border-soft">
        <div className={cn("mx-auto flex w-full items-center justify-between gap-sp-3 px-sp-4", widthClass[width])}>
          <Link
            href={isApp ? "/home" : "/"}
            className={cn("inline-flex min-h-touch items-center text-title font-semi", focusRing)}
          >
            {t("brand")}
          </Link>
          {isApp ? (
            <AppNav
              label={t("nav.label")}
              items={[
                { href: "/home", label: t("nav.home") },
                { href: "/chat", label: t("nav.chat") },
                { href: "/records", label: t("nav.records") },
                { href: "/settings/data", label: t("nav.settings") },
              ]}
            />
          ) : null}
          <LocaleSwitcher label={t("language")} />
        </div>
      </header>

      <main
        className={cn(
          "mx-auto flex w-full flex-1 flex-col gap-sp-6 px-sp-4 py-sp-6",
          widthClass[width],
          isApp && "cu-main-with-tabbar",
        )}
      >
        {children}
      </main>

      {isApp ? null : <PublicFooter locale={locale} width={width} />}
    </>
  );
}

async function PublicFooter({ locale, width }: { locale: string; width: "narrow" | "wide" }) {
  const t = await getTranslations("common");
  // Registration number comes from configuration (08-compliance.md section 1); demo text when unset.
  const regNo = process.env.FOREIGN_PATIENT_AGENCY_REG_NO;

  return (
    <footer lang={locale} className="border-t border-border-soft">
      <div className={cn("mx-auto flex w-full flex-col gap-sp-3 px-sp-4 py-sp-6", widthClass[width])}>
        <p className="text-label text-muted">
          {t("footer.regLabel")}: <span className="tabular-nums">{regNo ? regNo : t("footer.regDemo")}</span>
        </p>
        <Link
          href="/legal/patient-rights"
          className={cn("inline-flex min-h-touch items-center self-start text-label text-muted hover:text-text", focusRing)}
        >
          {t("footer.patientRights")}
        </Link>
        <p className="text-caption text-subtle">{t("footer.notice")}</p>
      </div>
    </footer>
  );
}
