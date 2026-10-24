import Link from "next/link";
import type { ReactNode } from "react";
import { focusRing } from "@/lib/ui";
import { OpsNav } from "./ops-nav";

// Sidebar from lg up, a scrolling tab row above the content below that. Grid rules live in styles/ops.css.
export function OpsShell({ children }: { children: ReactNode }) {
  return (
    <div className="ops-shell">
      <aside className="ops-sidebar flex flex-col border-b border-border-soft bg-bg lg:border-b-0 lg:border-e">
        <div className="flex items-baseline justify-between gap-sp-3 px-sp-4 py-sp-3 lg:flex-col lg:items-start lg:gap-sp-1 lg:py-sp-6">
          <p className="text-title font-semi">Pibu 운영</p>
          <Link href="/demo" className={`text-label text-muted hover:text-text ${focusRing}`}>
            데모 컨트롤
          </Link>
        </div>
        <OpsNav />
      </aside>
      <main className="ops-shell-main px-sp-4 py-sp-6 lg:px-sp-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-sp-6">{children}</div>
      </main>
    </div>
  );
}
