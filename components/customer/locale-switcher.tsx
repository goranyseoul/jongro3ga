"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { FiCheck, FiChevronDown, FiGlobe } from "react-icons/fi";
import { Link, usePathname } from "@/i18n/navigation";
import { LOCALES, LOCALE_NAME } from "@/app/[locale]/locales";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

// A dropdown of native language names, so a customer can always find their own language. Keeps the current
// page. Closes on a click outside, on Escape (focus returns to the trigger) and when a language is picked.
export function LocaleSwitcher({ label }: { label: string }) {
  const current = useLocale() as (typeof LOCALES)[number];
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <nav aria-label={label} ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex min-h-touch items-center gap-sp-2 rounded-pill border border-border-soft bg-elev px-sp-3 text-label text-text shadow-card transition-colors duration-press ease-out hover:bg-sunken",
          focusRing,
        )}
      >
        <FiGlobe aria-hidden className="size-sp-4 text-muted" />
        <span lang={current}>{LOCALE_NAME[current]}</span>
        <FiChevronDown aria-hidden className={cn("size-sp-4 text-muted transition-transform duration-press", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          id={menuId}
          className="theme-light absolute end-0 top-full z-20 mt-sp-2 flex min-w-full flex-col overflow-hidden rounded-card border border-border-soft bg-popover py-sp-1 shadow-pop animate-fade-in"
        >
          {LOCALES.map((locale) => (
            <li key={locale}>
              <Link
                href={pathname}
                locale={locale}
                hrefLang={locale}
                lang={locale}
                aria-current={locale === current ? "true" : undefined}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex min-h-touch items-center gap-sp-3 whitespace-nowrap px-sp-4 text-label transition-colors duration-press ease-out hover:bg-sunken",
                  locale === current ? "font-semi text-text" : "text-muted hover:text-text",
                  focusRing,
                )}
              >
                <span className="flex-1">{LOCALE_NAME[locale]}</span>
                {locale === current ? <FiCheck aria-hidden className="size-sp-4" /> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}
