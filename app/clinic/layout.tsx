import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ClinicShell } from "@/components/clinic/clinic-shell";
import "@/styles/clinic.css";

export const metadata: Metadata = {
  title: { default: "병원 콘솔 · PibooK", template: "%s · 병원 콘솔 · PibooK" },
};

export default function ClinicLayout({ children }: { children: ReactNode }) {
  return <ClinicShell>{children}</ClinicShell>;
}
