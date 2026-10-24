"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { CLINIC, CLINIC_ACCOUNTS, OPERATION_MODE_TEXT } from "@/lib/ui-data/clinic";
import { ClinicAccountMenu } from "./clinic-account-menu";
import { ClinicNav } from "./clinic-nav";
import { CLINIC_LOGIN_PATH, useClinicSession } from "./clinic-session";

// Header row below lg, sidebar from lg up (styles/clinic.css). The login page renders bare.
export function ClinicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { session } = useClinicSession();

  if (pathname === CLINIC_LOGIN_PATH) return <main className="clinic-auth">{children}</main>;

  const clinic = CLINIC_ACCOUNTS.find((c) => c.id === session?.clinicId) ?? CLINIC;

  return (
    <div className="clinic-shell">
      <aside className="clinic-side">
        <div className="clinic-brand">
          <p className="text-title font-semi">{clinic.name}</p>
          <p className="text-caption text-subtle">PibooK 병원 콘솔 · {OPERATION_MODE_TEXT[clinic.operationMode]}</p>
        </div>
        <ClinicNav />
        <div className="clinic-account">
          <ClinicAccountMenu />
        </div>
      </aside>
      <main className="clinic-content">{children}</main>
    </div>
  );
}
