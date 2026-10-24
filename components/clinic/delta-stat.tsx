import type { ReactNode } from "react";
import { Stat } from "@/components/ui";
import { cn } from "@/lib/cn";

export type Delta = {
  /** Signed difference, current minus previous. */
  diff: number;
  /** "건", "%p": appended to the number. */
  unit: string;
  /** What it is compared with, e.g. "지난주". */
  against: string;
};

export type DeltaStatProps = {
  label: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  delta: Delta;
};

// Only the delta carries semantic color (more is better on this dashboard); everything else stays neutral.
export function DeltaStat({ label, value, caption, delta }: DeltaStatProps) {
  const dir = delta.diff > 0 ? "up" : delta.diff < 0 ? "down" : "flat";
  const sign = dir === "up" ? "+" : dir === "down" ? "-" : "";

  return (
    <Stat
      label={label}
      value={value}
      caption={
        <span className="flex flex-col gap-sp-1">
          <span
            className={cn(
              "flex items-center gap-sp-1 tabular-nums",
              dir === "up" ? "text-success" : dir === "down" ? "text-danger" : "text-muted",
            )}
          >
            <Caret dir={dir} />
            {delta.against}보다 {dir === "flat" ? "변화 없음" : `${sign}${Math.abs(delta.diff)}${delta.unit}`}
          </span>
          {caption ? <span>{caption}</span> : null}
        </span>
      }
    />
  );
}

// Line caret as in the design system KPI block (no filled glyph).
function Caret({ dir }: { dir: "up" | "down" | "flat" }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="shrink-0"
    >
      {dir === "up" ? <path d="M5 14l7-7 7 7" /> : dir === "down" ? <path d="M5 10l7 7 7-7" /> : <path d="M6 12h12" />}
    </svg>
  );
}
