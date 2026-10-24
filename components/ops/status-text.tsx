import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StatusTone = "success" | "warning" | "danger" | "muted";

// Full class strings so Tailwind can see them.
const toneClass: Record<StatusTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-muted",
};

// A status is one flat colored word: no pill, no dot, no tint (05-screens.md rule 3).
export function StatusText({ tone = "muted", className, children }: { tone?: StatusTone; className?: string; children: ReactNode }) {
  return <span className={cn("font-med", toneClass[tone], className)}>{children}</span>;
}
