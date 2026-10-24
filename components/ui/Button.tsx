import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

type Variant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-brand-fg border border-brand",
  secondary: "bg-elev text-text border border-line",
  ghost: "bg-transparent text-text border border-transparent",
};

export function Button({ variant = "primary", className, type = "button", ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        "inline-flex min-h-touch items-center justify-center gap-sp-2 rounded-md px-sp-4 text-body font-med",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
  );
}
