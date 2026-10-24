"use client";

import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type SwitchProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name, e.g. "첫 방문 이벤트 노출". */
  label: string;
  disabled?: boolean;
};

// Flat toggle on a <button role="switch">. The outer box keeps the 44px touch target (05-screens.md rule 7).
export function Switch({ checked, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex min-h-touch min-w-touch items-center justify-center rounded-md disabled:pointer-events-none disabled:opacity-50",
        focusRing,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "relative block h-sp-6 w-sp-12 rounded-pill border transition-colors duration-press ease-out",
          checked ? "border-brand bg-brand" : "border-input bg-sunken",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 block size-sp-4 -translate-y-1/2 rounded-pill transition-all duration-press ease-out",
            checked ? "start-sp-6 bg-on-brand" : "start-sp-1 bg-muted",
          )}
        />
      </span>
    </button>
  );
}
