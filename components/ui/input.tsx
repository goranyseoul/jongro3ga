import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fieldBase, focusRing } from "@/lib/ui";

export type InputProps = Omit<ComponentProps<"input">, "size"> & {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
};

export function Input({ label, hint, error, id, className, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const messageId = `${inputId}-message`;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-sp-1">
      <label htmlFor={inputId} className="text-label font-med text-muted">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        className={cn(fieldBase, error ? "border-danger" : "border-input", focusRing, className)}
        {...rest}
      />
      {message ? (
        <p id={messageId} className={cn("text-caption", error ? "text-danger" : "text-subtle")}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
