"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";

export type ChatInputProps = {
  onSend: (text: string) => void;
  /** Accessible name of the text area. */
  label: string;
  /** Accessible name of the round send button. */
  sendLabel: string;
  placeholder?: string;
  disabled?: boolean;
  /** Small line left of the send button, e.g. a keyboard hint. */
  hint?: ReactNode;
  /** The field grows with its text up to this many lines, then scrolls. */
  maxRows?: number;
};

function ArrowUpIcon() {
  return (
    <svg viewBox="0 0 14 14" fill="none" aria-hidden="true" className="size-sp-4">
      <path
        d="M7 12V2M7 2L2.5 6.5M7 2L11.5 6.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Agent prompt bar: one rounded surface holding a growing text area, a hint line and a round send
// button (after 21st.dev jahed/ai-chat-input, without model picker, voice or attachments).
export function ChatInput({
  onSend,
  label,
  sendLabel,
  placeholder,
  disabled = false,
  hint,
  maxRows = 6,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && text.trim().length > 0;

  useLayoutEffect(() => {
    const field = fieldRef.current;
    if (!field) return;
    const style = getComputedStyle(field);
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const max = parseFloat(style.lineHeight) * maxRows + padding;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, max)}px`;
    field.style.overflowY = field.scrollHeight > max ? "auto" : "hidden";
  }, [text, maxRows]);

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <form
      className={cn(
        "flex flex-col rounded-3xl border border-input bg-elev shadow-card transition-colors duration-press ease-out focus-within:border-brand",
        disabled && "opacity-50",
      )}
      onMouseDown={(event) => {
        // a click anywhere on the surface lands in the text area, like the reference
        if (event.target === event.currentTarget) {
          event.preventDefault();
          fieldRef.current?.focus();
        }
      }}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        ref={fieldRef}
        aria-label={label}
        rows={1}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // Enter confirms an IME candidate (ja, zh, ko); only a plain Enter outside composition sends.
          if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
          }
        }}
        className="w-full resize-none bg-transparent px-sp-4 pt-sp-3 text-body text-text outline-none placeholder:text-subtle"
      />
      <div className="flex items-center justify-between gap-sp-3 pb-sp-2 pe-sp-2 ps-sp-4">
        <div className="min-w-0 text-caption text-subtle">{hint}</div>
        <button
          type="submit"
          aria-label={sendLabel}
          disabled={!canSend}
          className={cn(
            "inline-flex min-h-touch min-w-touch shrink-0 items-center justify-center rounded-pill transition duration-press ease-out active:scale-press",
            canSend ? "bg-brand text-on-brand hover:opacity-90" : "bg-sunken text-subtle",
            focusRing,
          )}
        >
          <ArrowUpIcon />
        </button>
      </div>
    </form>
  );
}
