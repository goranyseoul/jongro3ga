import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

/** Selectable option chip. Selection is shown with a border and weight change, not a tinted fill. */
export function Chip({ selected = false, className, type = "button", ...rest }: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cx(
        "inline-flex min-h-touch items-center rounded-md border px-sp-4 text-body",
        selected ? "border-text bg-elev font-semi text-text" : "border-line bg-elev font-reg text-muted",
        className,
      )}
      {...rest}
    />
  );
}
