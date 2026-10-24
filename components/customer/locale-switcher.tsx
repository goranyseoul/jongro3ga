"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALES, LOCALE_NAME } from "@/app/[locale]/locales";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

// Native names, so a customer can always find their own language. Keeps the current page. The current
// language is plain text, not a link: following it would reload the same page and drop what is on screen
// (the landing agent window lost its conversation that way).
export function LocaleSwitcher({ label }: { label: string }) {
  const current = useLocale();
  const pathname = usePathname();
  const item = "inline-flex min-h-touch min-w-touch items-center justify-center rounded-md px-sp-2 text-label";

  return (
    <nav aria-label={label} className="flex items-center">
      <ul className="flex items-center">
        {LOCALES.map((locale) => (
          <li key={locale}>
            {locale === current ? (
              <span lang={locale} aria-current="true" className={cn(item, "font-semi text-text")}>
                {LOCALE_NAME[locale]}
              </span>
            ) : (
              <Link
                href={pathname}
                locale={locale}
                hrefLang={locale}
                lang={locale}
                className={cn(item, "text-muted transition-colors duration-press ease-out hover:text-text", focusRing)}
              >
                {LOCALE_NAME[locale]}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}
