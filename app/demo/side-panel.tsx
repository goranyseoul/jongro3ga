"use client";

import { Button } from "@/components/ui";
import { StatusText, Tabs, panelId, tabId, type StatusTone } from "@/components/ops";
import {
  DEMO_BOOKING_STATE_LABEL,
  clinicName,
  formatMonthDayTime,
  type DemoBooking,
  type DemoBookingState,
} from "@/lib/ui-data/ops";

export type SideMode = "clinic" | "ops";

export type SidePanelProps = {
  mode: SideMode;
  onMode: (mode: SideMode) => void;
  /** Bookings that are already visible in the replay. */
  bookings: DemoBooking[];
  busy: string | null;
  onConfirm: (booking: DemoBooking) => void;
  onReject: (booking: DemoBooking) => void;
  onPropose: (booking: DemoBooking) => void;
};

const STATE_TONE: Record<DemoBookingState, StatusTone> = {
  pending: "warning",
  confirmed: "success",
  rejected: "danger",
  proposed: "muted",
};

const ID_PREFIX = "demo-side";
const EMPTY: Record<SideMode, string> = {
  clinic: "받은 요청이 없어요. 로그를 재생하면 Yuki의 예약 요청이 도착해요.",
  ops: "대행 병원의 예약 요청이 없어요.",
};

// Right column: what the clinic account sees (inbox of a direct clinic) or what the operator sees
// (queue of proxy clinics), switched by the tabs or by the persona.
export function SidePanel({ mode, onMode, bookings, busy, onConfirm, onReject, onPropose }: SidePanelProps) {
  const items = bookings.filter((booking) => booking.mode === (mode === "clinic" ? "clinic" : "proxy"));

  return (
    <section aria-label="병원 요청함과 운영 큐" className="ops-demo-panel rounded-card border border-border-soft bg-elev">
      <Tabs
        label="오른쪽 화면"
        idPrefix={ID_PREFIX}
        value={mode}
        onChange={onMode}
        tabs={[
          { value: "clinic", label: "병원 요청함" },
          { value: "ops", label: "운영 큐" },
        ]}
      />
      <div role="tabpanel" id={panelId(ID_PREFIX, mode)} aria-labelledby={tabId(ID_PREFIX, mode)} className="ops-demo-scroll px-sp-3">
        {items.length === 0 ? (
          <p className="py-sp-4 text-label text-muted">{EMPTY[mode]}</p>
        ) : (
          <ul>
            {items.map((booking) => (
              <li key={booking.id} className="flex flex-col gap-sp-3 border-b border-border-soft py-sp-3 last:border-b-0">
                <div className="flex flex-col gap-sp-1">
                  <span className="text-body font-med">
                    {booking.guestName} · {booking.summary}
                  </span>
                  <span className="text-label text-muted tabular-nums">
                    {mode === "ops" ? `${clinicName(booking.clinicId)} · ` : `${clinicName(booking.clinicId)} 계정 · `}
                    {formatMonthDayTime(booking.slot)} 예약 요청
                  </span>
                </div>
                {booking.state === "pending" ? (
                  mode === "clinic" ? (
                    <div className="flex flex-wrap gap-sp-2">
                      <Button onClick={() => onConfirm(booking)} disabled={busy !== null}>
                        확정
                      </Button>
                      <Button variant="secondary" onClick={() => onPropose(booking)} disabled={busy !== null}>
                        시간 제안
                      </Button>
                      <Button variant="secondary" onClick={() => onReject(booking)} disabled={busy !== null}>
                        거절
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-sp-2">
                      <Button onClick={() => onConfirm(booking)} disabled={busy !== null}>
                        병원 확인 완료 → 확정
                      </Button>
                      <Button variant="secondary" onClick={() => onReject(booking)} disabled={busy !== null}>
                        병원 거절
                      </Button>
                    </div>
                  )
                ) : (
                  <StatusText tone={STATE_TONE[booking.state]}>{DEMO_BOOKING_STATE_LABEL[booking.state]}</StatusText>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
