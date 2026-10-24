import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StatProps = {
  label: ReactNode;
  /** Empty values render as a middle dot, never a fake zero. */
  value?: ReactNode;
  caption?: ReactNode;
  className?: string;
};

export function Stat({ label, value, caption, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-sp-1", className)}>
      <span className="text-label text-muted">{label}</span>
      <span className="text-h2 font-semi tabular-nums">{value ?? "·"}</span>
      {caption ? <span className="text-caption text-subtle">{caption}</span> : null}
    </div>
  );
}
