import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClinicNav } from "@/components/clinic/clinic-nav";
import { CLINIC, OPERATION_MODE_TEXT } from "@/lib/ui-data/clinic";
import "@/styles/clinic.css";

export const metadata: Metadata = {
  title: { default: "병원 콘솔 · Pibu", template: "%s · 병원 콘솔 · Pibu" },
};

export default function ClinicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="clinic-shell">
      <aside className="clinic-side">
        <div className="clinic-brand">
          <p className="text-title font-semi">{CLINIC.name}</p>
          <p className="text-caption text-subtle">
            Pibu 병원 콘솔 · {OPERATION_MODE_TEXT[CLINIC.operationMode]}
          </p>
        </div>
        <ClinicNav />
      </aside>
      <main className="clinic-content">{children}</main>
    </div>
  );
}
