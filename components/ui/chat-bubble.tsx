import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ChatBubbleProps = {
  from: "agent" | "user";
  children: ReactNode;
  /** Small line under the bubble, e.g. a time or a translation note. */
  meta?: ReactNode;
  /** Agent avatar. When set, both sides sit in bubbles: the agent's beside the avatar, the customer's in the brand. */
  avatar?: ReactNode;
};

// Agent lines read as plain text, the customer's own lines sit in a neutral bubble
// (after 21st.dev serafimcloud/agent-chat). No brand fill: the core stays achromatic.
// With an avatar (the light agent window) it becomes a messenger: both sides in bubbles.
export function ChatBubble({ from, children, meta, avatar }: ChatBubbleProps) {
  const isUser = from === "user";
  if (avatar !== undefined) {
    return (
      <div className={cn("flex flex-col gap-sp-1", isUser ? "items-end" : "items-start")}>
        <div className={cn("flex max-w-full items-end gap-sp-2", isUser && "justify-end")}>
          {isUser ? null : avatar}
          <div
            className={cn(
              "min-w-0 whitespace-pre-wrap break-words rounded-2xl px-sp-4 py-sp-2 text-body",
              isUser
                ? "max-w-md rounded-br-sm bg-brand text-on-brand shadow-card"
                : "max-w-xl rounded-bl-sm border border-border-soft bg-elev text-text shadow-card",
            )}
          >
            {children}
          </div>
        </div>
        {meta ? <span className="text-caption text-subtle">{meta}</span> : null}
      </div>
    );
  }
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
