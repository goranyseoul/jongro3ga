import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type ChipProps = ComponentProps<"button"> & { selected?: boolean };

// Square neutral chip: no pill shape, no tint (BAN-1, BAN-2). Selection is a flat brand fill.
export function Chip({ selected = false, className, type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-touch items-center justify-center rounded-md border px-sp-4 text-body font-med transition-colors duration-press ease-out disabled:pointer-events-none disabled:opacity-50",
        selected ? "border-brand bg-brand text-on-brand" : "border-input bg-elev text-text hover:bg-sunken",
        focusRing,
        className,
      )}
      {...rest}
    />
  );
}
