"use client";

import { useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALES, LOCALE_NAME } from "@/app/[locale]/locales";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

// Native names, so a customer can always find their own language. Keeps the current page.
export function LocaleSwitcher({ label }: { label: string }) {
  const current = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={label} className="flex items-center">
      <ul className="flex items-center">
        {LOCALES.map((locale) => (
          <li key={locale}>
            <Link
              href={pathname}
              locale={locale}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === current ? "true" : undefined}
              className={cn(
                "inline-flex min-h-touch min-w-touch items-center justify-center rounded-md px-sp-2 text-label transition-colors duration-press ease-out",
                locale === current ? "font-semi text-text" : "text-muted hover:text-text",
                focusRing,
              )}
            >
              {LOCALE_NAME[locale]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
