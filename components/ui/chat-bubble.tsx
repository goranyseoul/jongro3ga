import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ChatBubbleProps = {
  from: "agent" | "user";
  children: ReactNode;
  /** Small line under the bubble, e.g. a time or a translation note. */
  meta?: ReactNode;
};

export function ChatBubble({ from, children, meta }: ChatBubbleProps) {
  const isUser = from === "user";
  return (
    <div className={cn("flex flex-col gap-sp-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-md whitespace-pre-wrap break-words rounded-xl px-sp-4 py-sp-3 text-body",
          isUser ? "bg-brand text-on-brand" : "border border-border-soft bg-elev text-text",
        )}
      >
        {children}
      </div>
      {meta ? <span className="text-caption text-subtle">{meta}</span> : null}
    </div>
  );
}
