"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { focusRing } from "@/lib/ui";
import { OpsAccountMenu } from "./ops-account-menu";
import { OpsNav } from "./ops-nav";
import { OPS_LOGIN_PATH } from "./ops-session";

// Sidebar from lg up, a header row with scrolling tabs below that. Grid rules live in styles/ops.css.
// The login page renders without the shell.
export function OpsShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === OPS_LOGIN_PATH) return <main className="ops-auth">{children}</main>;

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar border-b border-border-soft bg-bg lg:border-b-0 lg:border-e">
        <div className="ops-sidebar-head flex min-w-0 flex-wrap items-baseline gap-x-sp-3 ps-sp-4 pt-sp-3 lg:flex-col lg:items-start lg:gap-sp-1 lg:px-sp-4 lg:py-sp-6">
          <p className="text-title font-semi">PibooK 운영</p>
          <Link href="/demo" className={`flex min-h-touch items-center text-label text-muted hover:text-text ${focusRing}`}>
            데모 컨트롤
          </Link>
        </div>
        <OpsNav />
        <div className="ops-sidebar-account pe-sp-4 pt-sp-3 lg:p-sp-3">
          <OpsAccountMenu />
        </div>
      </aside>
      <main className="ops-shell-main px-sp-4 py-sp-6 lg:px-sp-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-sp-6">{children}</div>
      </main>
    </div>
  );
}
