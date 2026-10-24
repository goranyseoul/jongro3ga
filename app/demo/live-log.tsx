"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { A2ALogRow } from "@/components/ops";
import type { A2ALogEntry } from "@/lib/ui-data/ops";

export type LiveLogProps = {
  entries: A2ALogEntry[];
  /** Calls of the replayed request shown so far, and how many there are before the booking. */
  shown: number;
  steps: number;
  playing: boolean;
  onPlay: () => void;
};

// Middle column of the three-split view. The replay stands in for the real stream until the
// platform writes its log to the store.
export function LiveLog({ entries, shown, steps, playing, onPlay }: LiveLogProps) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);

  // follow the newest call
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries.length]);

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const done = shown >= steps;
  const playLabel = playing ? "재생 중" : done ? "재생 완료" : shown > 0 ? "이어서 재생" : "시나리오 재생";

  return (
    <section aria-label="A2A 로그" className="ops-demo-panel rounded-card border border-border-soft bg-elev">
      <div className="flex items-center justify-between gap-sp-3 border-b border-border-soft px-sp-3 py-sp-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-title font-semi">A2A 로그</h2>
          <p role="status" aria-live="polite" className="text-caption text-subtle tabular-nums">
            실시간 · {entries.length}건
          </p>
        </div>
        <Button variant="secondary" onClick={onPlay} disabled={playing || done}>
          {playLabel}
        </Button>
      </div>
      <div ref={scroller} className="ops-demo-scroll">
        {entries.length === 0 ? (
          <p className="p-sp-4 text-label text-muted">아직 호출이 없어요. [시나리오 재생]으로 Yuki의 요청 흐름을 재생해 보세요.</p>
        ) : (
          <ul>
            {entries.map((entry) => (
              <A2ALogRow key={entry.id} entry={entry} expanded={open.has(entry.id)} onToggle={() => toggle(entry.id)} compact />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
