import type { ReactNode } from "react";

export interface TimelineItem {
  id: string;
  title: ReactNode;
  caption?: ReactNode;
  time?: string;
  /** Detail shown under the item, for example an expandable raw JSON viewer. */
  detail?: ReactNode;
}

/** Vertical list with a thin neutral rail. No colored status dots. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((it) => (
        <li key={it.id} className="flex gap-sp-3 border-b border-line-soft py-sp-3 last:border-b-0">
          <span className="w-sp-12 shrink-0 text-xs text-subtle">{it.time}</span>
          <div className="min-w-0 flex-1">
            <div className="text-body text-text">{it.title}</div>
            {it.caption ? <div className="text-sm text-muted">{it.caption}</div> : null}
            {it.detail ? <div className="mt-sp-2">{it.detail}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
