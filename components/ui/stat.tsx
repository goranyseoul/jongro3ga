import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StatDelta = {
  /** Already formatted, e.g. "+1건" or "+3%p". */
  value: ReactNode;
  /** More is better here, so up is green and down is red. `flat` means no change. */
  dir: "up" | "down" | "flat";
  /** What it is compared with, e.g. "지난주". */
  against?: ReactNode;
};

export type StatProps = {
  label: ReactNode;
  /** Empty values render as a middle dot, never a fake zero. */
  value?: ReactNode;
  /** The change against an earlier period; only this line takes a semantic color. */
  delta?: StatDelta;
  caption?: ReactNode;
  className?: string;
};

const deltaTone = { up: "text-success", down: "text-danger", flat: "text-muted" } as const;

// Line caret as in the design system KPI block: no filled glyph, no pill.
function Caret({ dir }: { dir: StatDelta["dir"] }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-sp-4 shrink-0"
    >
      {dir === "up" ? <path d="M5 14l7-7 7 7" /> : dir === "down" ? <path d="M5 10l7 7 7-7" /> : <path d="M6 12h12" />}
    </svg>
  );
}

// KPI block of the design system (PA SectionCards): label, big value, change, caption.
export function Stat({ label, value, delta, caption, className }: StatProps) {
  return (
    <div className={cn("flex flex-col gap-sp-1", className)}>
      <span className="text-label text-subtle">{label}</span>
      <span className="text-h2 font-semi tabular-nums tracking-tight">{value ?? "·"}</span>
      {delta ? (
        <span className={cn("flex flex-wrap items-center gap-x-sp-1 text-caption tabular-nums", deltaTone[delta.dir])}>
          <Caret dir={delta.dir} />
          {delta.against ? <span>{delta.against}</span> : null}
          <span className="font-med">{delta.value}</span>
        </span>
      ) : null}
      {caption ? <span className="text-caption text-muted">{caption}</span> : null}
    </div>
  );
}
