"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

// P0 screens only (05-screens.md). P1 routes join this list when they exist.
const ITEMS = [
  { href: "/ops/clinics", label: "병원 레지스트리" },
  { href: "/ops/proxy-queue", label: "대행 응답 큐" },
  { href: "/ops/rules", label: "연결 규칙" },
  { href: "/ops/a2a-log", label: "A2A 로그" },
];

export function OpsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="운영 콘솔" className="flex flex-wrap gap-sp-1 px-sp-3 pb-sp-2 lg:flex-col lg:flex-nowrap lg:pb-0">
      {ITEMS.map((item) => {
        const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "flex min-h-touch shrink-0 items-center rounded-md px-sp-3 text-body transition-colors duration-press ease-out",
              current ? "bg-sunken font-med text-text" : "text-muted hover:text-text",
              focusRing,
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
