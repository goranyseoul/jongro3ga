import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-sp-2 rounded-md font-med transition duration-press ease-out active:scale-press disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:opacity-90",
  secondary: "border border-input bg-elev text-text hover:bg-sunken",
  ghost: "text-muted hover:text-text",
};

// Every size keeps the 44px touch target from 05-screens.md rule 7.
const sizes: Record<ButtonSize, string> = {
  md: "min-h-touch min-w-touch px-sp-4 text-body",
  lg: "min-h-sp-12 min-w-touch px-sp-6 text-title",
};

type StyleOptions = { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean };

// Exported so links (<a>, next/link) can look like buttons.
export function buttonStyles({ variant = "primary", size = "md", fullWidth = false }: StyleOptions = {}): string {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", focusRing);
}

export type ButtonProps = ComponentProps<"button"> & StyleOptions;

export function Button({ variant, size, fullWidth, className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={cn(buttonStyles({ variant, size, fullWidth }), className)} {...rest} />;
}
