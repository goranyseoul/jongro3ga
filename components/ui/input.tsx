import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fieldBase, focusRing } from "@/lib/ui";

export type InputProps = Omit<ComponentProps<"input">, "size"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Line icon shown inside the field before the text. With an icon, className styles the field box. */
  icon?: ReactNode;
};

export function Input({ label, hint, error, icon, id, className, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;
  const border = error ? "border-danger" : "border-input";

  const input = (
    <input
      id={inputId}
      aria-invalid={error ? true : undefined}
      aria-describedby={message ? messageId : undefined}
      className={
        icon
          ? "min-h-touch w-full min-w-0 flex-1 bg-transparent text-body text-text placeholder:text-subtle focus:outline-none disabled:opacity-50"
          : cn(fieldBase, border, focusRing, className)
      }
      {...rest}
    />
  );

  return (
    <div className="flex flex-col gap-sp-1">
      <label htmlFor={inputId} className="text-label font-med text-muted">
        {label}
      </label>
      {icon ? (
        // the box carries the border and the focus outline, so the icon sits inside the field
        <div
          className={cn(
            "flex items-center gap-sp-2 rounded-md border bg-elev px-sp-3 text-subtle focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand",
            border,
            className,
          )}
        >
          <span aria-hidden className="flex shrink-0">
            {icon}
          </span>
          {input}
        </div>
      ) : (
        input
      )}
      {message ? (
        <p id={messageId} className={cn("text-caption", error ? "text-danger" : "text-subtle")}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
