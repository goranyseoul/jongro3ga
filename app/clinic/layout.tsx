import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClinicNav } from "@/components/clinic/clinic-nav";
import { OPERATION_MODE_TEXT } from "@/lib/ui-data/clinic";
import { currentClinic } from "./console-session";
import "@/styles/clinic.css";

export const metadata: Metadata = {
  title: { default: "병원 콘솔 · PibooK", template: "%s · 병원 콘솔 · PibooK" },
};

export default async function ClinicLayout({ children }: { children: ReactNode }) {
  const clinic = await currentClinic();

  return (
    <div className="clinic-shell">
      <aside className="clinic-side">
        <div className="clinic-brand">
          <p className="text-title font-semi">{clinic?.name ?? "병원 콘솔"}</p>
          <p className="text-caption text-subtle">
            PibooK 병원 콘솔{clinic ? ` · ${OPERATION_MODE_TEXT[clinic.operationMode]}` : ""}
          </p>
        </div>
        <ClinicNav />
      </aside>
      <main className="clinic-content">{children}</main>
    </div>
  );
}
