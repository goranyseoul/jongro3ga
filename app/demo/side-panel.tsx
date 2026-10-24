"use client";

import Link from "next/link";
import { Button } from "@/components/ui";
import { StatusText, Tabs, panelId, tabId, type StatusTone } from "@/components/ops";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import { BOOKING_STATUS_LABEL, bookingSummary, formatMonthDayTime, type BookingStatus, type OpsBooking } from "@/lib/ui-data/ops";

export type SideMode = "clinic" | "ops";

export type SidePanelProps = {
  mode: SideMode;
  onMode: (mode: SideMode) => void;
  bookings: OpsBooking[];
  busy: string | null;
  onConfirm: (booking: OpsBooking) => void;
  /** Proxy bookings only: the operator records the clinic's refusal. */
  onReject: (booking: OpsBooking) => void;
};

const STATE_TONE: Record<BookingStatus, StatusTone> = {
  pending_clinic: "warning",
  confirmed: "success",
  canceled: "danger",
  no_show: "danger",
  completed: "muted",
};

const ID_PREFIX = "demo-side";
const EMPTY: Record<SideMode, string> = {
  clinic: "직접 운영 병원이 받은 예약 요청이 없어요.",
  ops: "대행 병원의 예약 요청이 없어요.",
};

// Right column: what the clinic account sees (bookings of direct clinics) or what the operator sees
// (queue of proxy clinics), switched by the tabs or by the persona. Both read the clinic agent's bookings.
export function SidePanel({ mode, onMode, bookings, busy, onConfirm, onReject }: SidePanelProps) {
  const items = bookings.filter((booking) => booking.operationMode === (mode === "clinic" ? "clinic" : "proxy"));

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
              <li key={booking.bookingId} className="flex flex-col gap-sp-3 border-b border-border-soft py-sp-3 last:border-b-0">
                <div className="flex flex-col gap-sp-1">
                  <span className="text-body font-med">
                    {booking.guest.displayName} · {bookingSummary(booking)}
                  </span>
                  <span className="text-label text-muted tabular-nums">
                    {mode === "ops" ? `${booking.clinicName} · ` : `${booking.clinicName} 계정 · `}
                    {formatMonthDayTime(booking.slot)} 예약 요청
                  </span>
                </div>
                {booking.status === "pending_clinic" ? (
                  mode === "clinic" ? (
                    <div className="flex flex-wrap items-center gap-sp-2">
                      <Button onClick={() => onConfirm(booking)} disabled={busy !== null}>
                        확정
                      </Button>
                      <Link href="/clinic/inbox" className={cn("text-label text-muted underline", focusRing)}>
                        시간 제안·거절은 병원 요청함에서
                      </Link>
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
                  <StatusText tone={STATE_TONE[booking.status]}>{BOOKING_STATUS_LABEL[booking.status]}</StatusText>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
