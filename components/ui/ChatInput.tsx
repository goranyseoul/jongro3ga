"use client";

import { useState, type FormEvent } from "react";
import { Button } from "./Button";

export interface ChatInputProps {
  onSend: (text: string) => void;
  placeholder?: string;
  sendLabel?: string;
  disabled?: boolean;
}

export function ChatInput({ onSend, placeholder, sendLabel = "Send", disabled }: ChatInputProps) {
  const [text, setText] = useState("");

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-sp-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={placeholder ?? sendLabel}
        className="min-h-touch min-w-0 flex-1 rounded-md border border-line bg-elev px-sp-3 text-body text-text placeholder:text-subtle"
      />
      <Button type="submit" disabled={disabled || text.trim() === ""}>
        {sendLabel}
      </Button>
    </form>
  );
}
