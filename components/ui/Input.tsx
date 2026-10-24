import type { InputHTMLAttributes } from "react";
import { cx } from "./cx";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, id, className, ...rest }: InputProps) {
  const inputId = id ?? rest.name;
  return (
    <div className="flex flex-col gap-sp-1">
      {label ? (
        <label htmlFor={inputId} className="text-sm font-med text-muted">
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        className={cx(
          "min-h-touch w-full rounded-md border border-line bg-elev px-sp-3 text-body text-text",
          "placeholder:text-subtle",
          className,
        )}
        {...rest}
      />
      {hint ? <p className="text-xs text-subtle">{hint}</p> : null}
    </div>
  );
}
