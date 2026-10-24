"use client";

// Floating agent window, mounted once in app/[locale]/layout.tsx. Placeholder until the dock UI lands;
// it reads the agent context so the provider wiring is already exercised.
import { useAgent } from "./agent-context";

export function AgentDock() {
  useAgent();
  return null;
}
