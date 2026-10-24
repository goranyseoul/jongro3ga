import type { ReactNode } from "react";
import { focusRing } from "@/lib/ui";
import { JsonViewer } from "./json-viewer";

export type TimelineItem = {
  id: string;
  /** Pre-formatted time, the caller owns locale and time zone. */
  at?: string;
  title: ReactNode;
  detail?: ReactNode;
  /** Original payload (for A2A steps, the JSON-RPC message), shown behind a toggle. */
  raw?: unknown;
};

export type TimelineProps = {
  items: TimelineItem[];
  /** Toggle text for the raw payload. */
  rawLabel: string;
};

export function Timeline({ items, rawLabel }: TimelineProps) {
  return (
    <ol className="flex flex-col">
      {items.map((item) => (
        <li key={item.id} className="group flex gap-sp-3">
          <div className="flex flex-col items-center">
            <span className="mt-sp-2 size-sp-2 shrink-0 rounded-pill bg-subtle" />
            <span className="flex-1 border-s border-border group-last:hidden" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-sp-1 pb-sp-4 group-last:pb-0">
            {item.at ? <span className="text-caption text-subtle tabular-nums">{item.at}</span> : null}
            <div className="text-body">{item.title}</div>
            {item.detail ? <div className="text-label text-muted">{item.detail}</div> : null}
            {item.raw !== undefined ? (
              <details>
                <summary
                  className={`flex min-h-touch cursor-pointer items-center text-label text-muted hover:text-text ${focusRing}`}
                >
                  {rawLabel}
                </summary>
                <JsonViewer value={item.raw} />
              </details>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
