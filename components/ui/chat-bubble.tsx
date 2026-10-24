import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ChatBubbleProps = {
  from: "agent" | "user";
  children: ReactNode;
  /** Small line under the bubble, e.g. a time or a translation note. */
  meta?: ReactNode;
};

// Agent lines read as plain text, the customer's own lines sit in a neutral bubble
// (after 21st.dev serafimcloud/agent-chat). No brand fill: the core stays achromatic.
export function ChatBubble({ from, children, meta }: ChatBubbleProps) {
  const isUser = from === "user";
  return (
    <div className={cn("flex flex-col gap-sp-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "whitespace-pre-wrap break-words text-body",
          isUser ? "max-w-md rounded-2xl bg-sunken px-sp-4 py-sp-2 text-text" : "max-w-xl py-sp-1 text-text",
        )}
      >
        {children}
      </div>
      {meta ? <span className="text-caption text-subtle">{meta}</span> : null}
    </div>
  );
}
