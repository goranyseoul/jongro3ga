import Link from "next/link";
import { buttonStyles } from "@/components/ui";
import { LocaleSwitcher } from "@/components/customer/locale-switcher";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/domain/common";
import { focusRing } from "@/lib/ui";
import { LANDING_COPY } from "./landing-copy";
import { LOCALES, LOCALE_NAME } from "./locales";

export const container = "mx-auto w-full max-w-screen-xl px-sp-4 md:px-sp-6";

const textLink = cn("inline-flex min-h-touch items-center text-label text-muted hover:text-text", focusRing);

export function SiteNav({ locale }: { locale: Locale }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border-soft bg-bg">
      <div className={cn(container, "flex flex-wrap items-center justify-between gap-x-sp-3 py-sp-2")}>
        <Link href={`/${locale}`} className={cn("inline-flex min-h-touch items-center text-title font-semi", focusRing)}>
          PibooK
        </Link>
        <div className="order-last flex w-full justify-center sm:order-none sm:w-auto sm:flex-1 sm:justify-end">
          <LocaleSwitcher label={LANDING_COPY[locale].footer.languages} />
        </div>
        <Link href={`/${locale}`} className={buttonStyles()}>
          {LANDING_COPY[locale].start}
        </Link>
      </div>
    </header>
  );
}

/** `path` is the page path after the locale, so the language links keep the reader on the same page. */
export function SiteFooter({ locale, path = "" }: { locale: Locale; path?: string }) {
  const c = LANDING_COPY[locale].footer;
  // FOREIGN_PATIENT_AGENCY_REG_NO is empty until the agency is registered (08-compliance.md 1절).
  const regNo = process.env.FOREIGN_PATIENT_AGENCY_REG_NO || c.regDemo;

  return (
    <footer className="border-t border-border-soft py-sp-12">
      <div className={cn(container, "flex flex-col gap-sp-6 md:flex-row md:justify-between")}>
        <div className="flex flex-col gap-sp-2">
          <p className="text-title font-semi">PibooK</p>
          <p className="text-label text-muted">
            {c.regLabel}: <span className="tabular-nums">{regNo}</span>
          </p>
          <Link href={`/${locale}/legal/patient-rights`} className={textLink}>
            {c.patientRights}
          </Link>
          <p className="text-caption text-subtle">{c.demoNotice}</p>
        </div>
        <nav aria-label={c.languages} className="flex flex-col gap-sp-1">
          <p className="text-label text-subtle">{c.languages}</p>
          <ul className="flex flex-wrap gap-x-sp-4">
            {LOCALES.map((l) => (
              <li key={l}>
                <Link
                  href={`/${l}${path}`}
                  lang={l}
                  aria-current={l === locale ? "page" : undefined}
                  className={cn(textLink, "min-w-touch justify-center", l === locale && "text-text")}
                >
                  {LOCALE_NAME[l]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
