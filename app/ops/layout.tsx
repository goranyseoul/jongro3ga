import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OpsShell } from "@/components/ops";
import "@/styles/ops.css";

export const metadata: Metadata = {
  title: { default: "운영 콘솔 · Pibu", template: "%s · 운영 콘솔 · Pibu" },
};

export default function OpsLayout({ children }: { children: ReactNode }) {
  return <OpsShell>{children}</OpsShell>;
}
