"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/clinic/dashboard", label: "대시보드" },
  { href: "/clinic/inbox", label: "요청함" },
  { href: "/clinic/menu", label: "메뉴·가격" },
  { href: "/clinic/agent", label: "내 에이전트" },
];

// Plain CSS classes live in styles/clinic.css (shell layout, active state through aria-current).
export function ClinicNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="병원 콘솔" className="clinic-nav">
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          aria-current={pathname === link.href || pathname.startsWith(`${link.href}/`) ? "page" : undefined}
          className="clinic-nav-link"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
