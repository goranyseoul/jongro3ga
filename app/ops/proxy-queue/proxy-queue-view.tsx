"use client";

import { useState } from "react";
import { Button, Money, Table, type TableColumn } from "@/components/ui";
import { StatusText, Tabs, panelId, tabId, type StatusTone } from "@/components/ops";
import {
  LOCALE_LABEL,
  PROXY_BOOKINGS,
  PROXY_STATE_LABEL,
  OPS_NOW,
  clinicName,
  formatElapsed,
  formatMonthDayTime,
  type ProxyBooking,
  type ProxyBookingState,
} from "@/lib/ui-data/ops";

type QueueTab = "waiting" | "done";

const STATE_TONE: Record<ProxyBookingState, StatusTone> = {
  waiting_clinic: "warning",
  confirmed: "success",
  rejected: "danger",
};

const ID_PREFIX = "proxy-queue";

export function ProxyQueueView() {
  const [bookings, setBookings] = useState<ProxyBooking[]>(PROXY_BOOKINGS);
  const [tab, setTab] = useState<QueueTab>("waiting");
  const [result, setResult] = useState<string | null>(null);

  const waiting = bookings.filter((booking) => booking.state === "waiting_clinic");
  const done = bookings.filter((booking) => booking.state !== "waiting_clinic");

  const resolve = (booking: ProxyBooking, state: "confirmed" | "rejected") => {
    setBookings((current) =>
      current.map((item) =>
        item.id === booking.id
          ? { ...item, state, resolvedAt: OPS_NOW, note: state === "rejected" ? "병원 거절" : undefined }
          : item,
      ),
    );
    setResult(
      state === "confirmed"
        ? `${clinicName(booking.clinicId)} 예약을 확정했어요. ${booking.guest.displayName}님의 에이전트에 확정 알림을 보냈어요.`
        : `${clinicName(booking.clinicId)} 예약을 거절 처리했어요. ${booking.guest.displayName}님의 에이전트에 다른 병원 안내를 요청했어요.`,
    );
  };

  const baseColumns: TableColumn<ProxyBooking>[] = [
    {
      key: "clinic",
      header: "병원",
      card: "title",
      cell: (booking) => (
        <div className="flex flex-col gap-sp-1">
          <span className="font-med">{clinicName(booking.clinicId)}</span>
          <span className="text-caption font-reg text-subtle">대행 · 참고가</span>
        </div>
      ),
    },
    {
      key: "guest",
      header: "고객",
      cell: (booking) => (
        <div className="flex flex-col gap-sp-1 md:items-start">
          <span>{booking.guest.displayName}</span>
          <span className="text-caption text-subtle">
            {booking.guest.agentId} · {LOCALE_LABEL[booking.guest.language]}
          </span>
        </div>
      ),
    },
    {
      key: "item",
      header: "시술",
      cell: (booking) => (
        <div className="flex flex-col gap-sp-1 md:items-start">
          <span>
            {booking.procedure} {booking.amountText}
          </span>
          <span className="text-caption text-muted">
            <Money krw={booking.priceKrw} /> · VAT {booking.vatIncluded ? "포함" : "별도"}
          </span>
        </div>
      ),
    },
    { key: "slot", header: "희망 시간", cell: (booking) => formatMonthDayTime(booking.slot) },
    { key: "requested", header: "접수", card: "caption", cell: (booking) => `접수 ${formatElapsed(booking.requestedAt)}` },
  ];

  const waitingColumns: TableColumn<ProxyBooking>[] = [
    ...baseColumns,
    {
      key: "actions",
      header: "처리",
      card: "action",
      cell: (booking) => (
        <div className="flex flex-col gap-sp-2">
          <Button onClick={() => resolve(booking, "confirmed")}>병원 확인 완료 → 확정</Button>
          <Button variant="secondary" onClick={() => resolve(booking, "rejected")}>
            병원 거절
          </Button>
        </div>
      ),
    },
  ];

  const doneColumns: TableColumn<ProxyBooking>[] = [
    ...baseColumns,
    {
      key: "result",
      header: "처리 결과",
      cell: (booking) => (
        <div className="flex flex-col gap-sp-1 md:items-start">
          <StatusText tone={STATE_TONE[booking.state]}>{PROXY_STATE_LABEL[booking.state]}</StatusText>
          <span className="text-caption text-subtle">
            {booking.resolvedAt ? formatMonthDayTime(booking.resolvedAt) : null}
            {booking.note ? ` · ${booking.note}` : null}
          </span>
        </div>
      ),
    },
  ];

  return (
    <section className="flex flex-col gap-sp-4">
      <Tabs
        label="대행 응답 큐"
        idPrefix={ID_PREFIX}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "waiting", label: "병원 확인 대기", count: waiting.length },
          { value: "done", label: "처리 완료", count: done.length },
        ]}
      />

      <p role="status" aria-live="polite" className="min-h-sp-6 text-body text-muted">
        {result}
      </p>

      <div role="tabpanel" id={panelId(ID_PREFIX, tab)} aria-labelledby={tabId(ID_PREFIX, tab)}>
        {tab === "waiting" ? (
          <Table
            caption="병원 확인 대기 예약 요청"
            columns={waitingColumns}
            rows={waiting}
            rowKey={(booking) => booking.id}
            empty="대기 중인 요청이 없어요."
          />
        ) : (
          <Table
            caption="처리 완료 예약 요청"
            columns={doneColumns}
            rows={done}
            rowKey={(booking) => booking.id}
            empty="처리한 요청이 아직 없어요."
          />
        )}
      </div>
    </section>
  );
}
