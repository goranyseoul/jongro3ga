"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  /**
   * Rests as a narrow one-line pill and opens to the full width and the send row on focus,
   * folding back when it loses focus empty. Meant for the first, empty state of a screen.
   */
  collapsible?: boolean;
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

// Width and send row move with the sheet motion tokens: ease-out curve, 400ms, instant under reduced motion.
const morph = "var(--dur-modal) var(--ease-drawer)";
const COLLAPSED_WIDTH = "calc(var(--sp-16) * 5)";

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
  collapsible = false,
}: ChatInputProps) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && text.trim().length > 0;
  const expanded = !collapsible || focused || text.length > 0;

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

  const shell: CSSProperties = collapsible
    ? { maxWidth: expanded ? "100%" : COLLAPSED_WIDTH, transition: `max-width ${morph}` }
    : {};

  return (
    // chat-neon: the sunrise ring turning around the bar (globals.css), brighter while the bar has focus
    <div className={cn("chat-neon relative mx-auto w-full rounded-3xl", disabled && "chat-neon-off")} style={shell}>
      <form
        className={cn(
          "relative flex flex-col overflow-hidden rounded-3xl border border-input bg-elev shadow-card transition-colors duration-press ease-out",
          disabled && "opacity-50",
        )}
        onFocus={() => setFocused(true)}
        onBlur={(event) => {
          // focus moving to the send button keeps the bar open
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
        }}
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
            if (event.key === "Escape" && collapsible && text === "") event.currentTarget.blur();
          }}
          className={cn(
            "w-full resize-none bg-transparent px-sp-4 pt-sp-3 text-body text-text outline-none placeholder:text-subtle",
            // the one-line pill needs the same room above and below the text
            collapsible && !expanded ? "pb-sp-3" : "pb-0",
          )}
        />
        <div
          style={{ display: "grid", gridTemplateRows: expanded ? "1fr" : "0fr", transition: `grid-template-rows ${morph}` }}
        >
          <div className="min-h-0 overflow-hidden" inert={!expanded}>
            <div
              className={cn(
                "flex items-center justify-between gap-sp-3 pb-sp-2 pe-sp-2 ps-sp-4 transition-opacity duration-dropdown ease-out",
                expanded ? "opacity-100" : "opacity-0",
              )}
            >
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
          </div>
        </div>
      </form>
    </div>
  );
}
