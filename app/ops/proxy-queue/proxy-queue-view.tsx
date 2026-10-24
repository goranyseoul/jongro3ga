"use client";

import { useState } from "react";
import { Button, Money, Table, type TableColumn } from "@/components/ui";
import { LoadState, StatusText, Tabs, panelId, tabId, useApi, type StatusTone } from "@/components/ops";
import {
  BOOKING_STATUS_LABEL,
  LOCALE_LABEL,
  bookingSummary,
  confirmProxyBooking,
  errorText,
  fetchProxyQueue,
  formatElapsed,
  formatMonthDayTime,
  rejectProxyBooking,
  type BookingStatus,
  type OpsBooking,
} from "@/lib/ui-data/ops";

type QueueTab = "waiting" | "done";

const STATE_TONE: Record<BookingStatus, StatusTone> = {
  pending_clinic: "warning",
  confirmed: "success",
  canceled: "danger",
  no_show: "danger",
  completed: "muted",
};

const ID_PREFIX = "proxy-queue";
// New booking requests arrive from customer agents while the operator has the page open.
const POLL_MS = 5000;

export function ProxyQueueView() {
  const { data, error, loading, reload } = useApi(fetchProxyQueue, POLL_MS);
  const [tab, setTab] = useState<QueueTab>("waiting");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const waiting = data?.waiting ?? [];
  const done = data?.done ?? [];
  const now = data?.now ?? "";

  const resolve = async (booking: OpsBooking, action: "confirm" | "reject") => {
    setBusy(booking.bookingId);
    setResult(null);
    try {
      if (action === "confirm") await confirmProxyBooking(booking.bookingId);
      else await rejectProxyBooking(booking.bookingId);
      setResult(
        action === "confirm"
          ? `${booking.clinicName} 예약을 확정했어요. ${booking.guest.displayName}님의 에이전트가 확정을 받아요.`
          : `${booking.clinicName} 예약을 거절 처리했어요. ${booking.guest.displayName}님의 에이전트가 거절을 받아요.`,
      );
    } catch (failure) {
      setResult(`처리하지 못했어요. ${errorText(failure)}`);
    } finally {
      setBusy(null);
      await reload();
    }
  };

  const baseColumns: TableColumn<OpsBooking>[] = [
    {
      key: "clinic",
      header: "병원",
      card: "title",
      cell: (booking) => (
        <div className="flex flex-col gap-sp-1">
          <span className="font-med">{booking.clinicName}</span>
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
            {booking.guest.agentId ? `${booking.guest.agentId} · ` : ""}
            {LOCALE_LABEL[booking.guest.language] ?? booking.guest.language}
          </span>
        </div>
      ),
    },
    {
      key: "item",
      header: "시술",
      cell: (booking) => (
        <div className="flex flex-col gap-sp-1 md:items-start">
          <span>{bookingSummary(booking)}</span>
          {booking.quote?.priceKrw !== undefined ? (
            <span className="text-caption text-muted">
              <Money krw={booking.quote.priceKrw} /> · VAT {booking.quote.vatIncluded ? "포함" : "별도"}
            </span>
          ) : null}
        </div>
      ),
    },
    { key: "slot", header: "희망 시간", cell: (booking) => formatMonthDayTime(booking.slot) },
    {
      key: "requested",
      header: "접수",
      card: "caption",
      cell: (booking) => (booking.requestedAt && now ? `접수 ${formatElapsed(booking.requestedAt, now)}` : "접수 시각 없음"),
    },
  ];

  const waitingColumns: TableColumn<OpsBooking>[] = [
    ...baseColumns,
    {
      key: "actions",
      header: "처리",
      card: "action",
      cell: (booking) => (
        <div className="flex flex-col gap-sp-2">
          <Button onClick={() => resolve(booking, "confirm")} disabled={busy !== null}>
            병원 확인 완료 → 확정
          </Button>
          <Button variant="secondary" onClick={() => resolve(booking, "reject")} disabled={busy !== null}>
            병원 거절
          </Button>
        </div>
      ),
    },
  ];

  const doneColumns: TableColumn<OpsBooking>[] = [
    ...baseColumns,
    {
      key: "result",
      header: "처리 결과",
      cell: (booking) => (
        <div className="flex flex-col gap-sp-1 md:items-start">
          <StatusText tone={STATE_TONE[booking.status]}>{BOOKING_STATUS_LABEL[booking.status]}</StatusText>
          {booking.resolvedAt ? <span className="text-caption text-subtle">{formatMonthDayTime(booking.resolvedAt)}</span> : null}
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

      <LoadState what="대행 응답 큐" loading={loading && !data} error={error} onRetry={reload} />

      <p role="status" aria-live="polite" className={result ? "text-body text-muted" : "sr-only"}>
        {result}
      </p>

      <div role="tabpanel" id={panelId(ID_PREFIX, tab)} aria-labelledby={tabId(ID_PREFIX, tab)}>
        {tab === "waiting" ? (
          <Table
            caption="병원 확인 대기 예약 요청"
            columns={waitingColumns}
            rows={waiting}
            rowKey={(booking) => booking.bookingId}
            empty="대기 중인 요청이 없어요."
          />
        ) : (
          <Table
            caption="처리 완료 예약 요청"
            columns={doneColumns}
            rows={done}
            rowKey={(booking) => booking.bookingId}
            empty="처리한 요청이 아직 없어요."
          />
        )}
      </div>
    </section>
  );
}
