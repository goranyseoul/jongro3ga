"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export type CopyButtonProps = {
  text: string;
  label: string;
};

// Clipboard can be blocked (insecure origin, permissions), so failure is reported instead of swallowed.
export function CopyButton({ text, label }: CopyButtonProps) {
  const [result, setResult] = useState<"idle" | "copied" | "failed">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setResult("copied");
    } catch {
      setResult("failed");
    }
  };

  return (
    <div className="flex items-center gap-sp-3">
      <Button variant="secondary" onClick={copy}>
        {label}
      </Button>
      <span role="status" aria-live="polite" className="text-label text-muted">
        {result === "copied" ? "복사했어요" : result === "failed" ? "복사하지 못했어요. 직접 선택해 복사해 주세요" : ""}
      </span>
    </div>
  );
}
