"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { fieldBase, focusRing } from "@/lib/ui";
import { Button } from "./button";

export type ChatInputProps = {
  onSend: (text: string) => void;
  /** Accessible name of the text area. */
  label: string;
  sendLabel: string;
  placeholder?: string;
  disabled?: boolean;
};

export function ChatInput({ onSend, label, sendLabel, placeholder, disabled = false }: ChatInputProps) {
  const [text, setText] = useState("");
  const canSend = !disabled && text.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <form
      className="flex items-end gap-sp-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        aria-label={label}
        rows={2}
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
        className={cn(fieldBase, "flex-1 resize-none border-input py-sp-2", focusRing)}
      />
      <Button type="submit" disabled={!canSend}>
        {sendLabel}
      </Button>
    </form>
  );
}
