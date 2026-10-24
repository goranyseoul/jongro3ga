"use client";

import { useAgent } from "@/components/customer/agent-context";
import type { Locale } from "@/lib/domain/common";
import { LandingHome } from "./landing-home";

// Landing sections wired to the floating agent: every tap becomes a message in the agent window.
export function LandingEntry({ locale }: { locale: Locale }) {
  const { ask } = useAgent();
  return (
    <div className="theme-sunrise">
      <LandingHome locale={locale} onAsk={ask} />
    </div>
  );
}
