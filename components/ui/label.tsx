import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Locale } from "@/lib/domain/common";
import { VERDICT_TEXT, VERDICT_TONE, type VerdictLabel, type VerdictTone } from "@/lib/domain/verdict";

// Full class strings so Tailwind can see them.
const toneClass: Record<VerdictTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  muted: "text-muted",
};

export type LabelProps = {
  verdict: VerdictLabel;
  locale: Locale;
  /** One-line evidence under the word, e.g. the dose warning for an underdosed quote. */
  reason?: ReactNode;
  /** Sample size behind the verdict, shown as "n=42". */
  sampleSize?: number;
  className?: string;
};

// Price verdict as a flat text label: one semantic-colored word, no pill, no tint (05-screens.md rule 3).
export function Label({ verdict, locale, reason, sampleSize, className }: LabelProps) {
  return (
    <div className={cn("flex flex-col gap-sp-1", className)}>
      <p className="flex items-baseline gap-sp-2">
        <span className={cn("text-body font-semi", toneClass[VERDICT_TONE[verdict]])}>{VERDICT_TEXT[verdict][locale]}</span>
        {sampleSize !== undefined ? <span className="text-caption text-subtle tabular-nums">n={sampleSize}</span> : null}
      </p>
      {reason ? <p className="text-caption text-muted">{reason}</p> : null}
    </div>
  );
}
