"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { A2ALogRow } from "@/components/ops";
import type { A2ALogEntry, ClinicNames } from "@/lib/ui-data/ops";

export type LiveLogProps = {
  entries: A2ALogEntry[];
  clinics: ClinicNames;
  /** Whether the log is being polled. */
  following: boolean;
  onFollow: (following: boolean) => void;
  error: string | null;
};

// Middle column of the three-split view: the real A2A log (GET /api/ops/a2a-log), polled.
export function LiveLog({ entries, clinics, following, onFollow, error }: LiveLogProps) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);

  // follow the newest call
  useEffect(() => {
    const el = scroller.current;
    if (el && following) el.scrollTop = el.scrollHeight;
  }, [entries.length, following]);

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section aria-label="A2A 로그" className="ops-demo-panel rounded-card border border-border-soft bg-elev">
      <div className="flex items-center justify-between gap-sp-3 border-b border-border-soft px-sp-3 py-sp-2">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-title font-semi">A2A 로그</h2>
          <p role="status" aria-live="polite" className="text-caption text-subtle tabular-nums">
            {error ? `불러오지 못했어요. ${error}` : `${following ? "실시간" : "멈춤"} · ${entries.length}건`}
          </p>
        </div>
        <Button variant="secondary" onClick={() => onFollow(!following)}>
          {following ? "일시정지" : "다시 따라가기"}
        </Button>
      </div>
      <div ref={scroller} className="ops-demo-scroll">
        {entries.length === 0 ? (
          <p className="p-sp-4 text-label text-muted">아직 호출이 없어요. 왼쪽 고객 화면에서 요청을 보내면 에이전트 대화가 여기에 쌓여요.</p>
        ) : (
          <ul>
            {entries.map((entry) => (
              <A2ALogRow key={entry.id} entry={entry} clinics={clinics} expanded={open.has(entry.id)} onToggle={() => toggle(entry.id)} compact />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
