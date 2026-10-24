"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type AppNavItem = { href: string; label: string };

// Phones: fixed bottom tab bar. md and up: inline in the header.
export function AppNav({ items, label }: { items: AppNavItem[]; label: string }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={label}
      className="cu-tabbar fixed inset-x-0 bottom-0 z-10 border-t border-border-soft bg-bg md:static md:border-0 md:bg-transparent"
    >
      <ul className="mx-auto flex max-w-3xl md:gap-sp-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1 md:flex-none">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-touch items-center justify-center px-sp-3 text-body transition-colors duration-press ease-out md:rounded-md",
                  active ? "font-semi text-text" : "text-muted hover:text-text",
                  focusRing,
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
