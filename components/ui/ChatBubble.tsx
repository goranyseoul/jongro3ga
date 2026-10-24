import type { ReactNode } from "react";
import { cx } from "./cx";

export interface ChatBubbleProps {
  role: "user" | "agent";
  children: ReactNode;
  name?: string;
}

export function ChatBubble({ role, children, name }: ChatBubbleProps) {
  const mine = role === "user";
  return (
    <div className={cx("flex flex-col gap-sp-1", mine ? "items-end" : "items-start")} data-role={role}>
      {name ? <span className="text-xs text-subtle">{name}</span> : null}
      <div
        className={cx(
          "max-w-prose rounded-xl px-sp-4 py-sp-3 text-body",
          mine ? "bg-brand text-brand-fg" : "border border-line bg-elev text-text",
        )}
      >
        {children}
      </div>
    </div>
  );
}
