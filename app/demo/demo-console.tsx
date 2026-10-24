"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { buttonStyles } from "@/components/ui";
import { PageHeader, useApi } from "@/components/ops";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import {
  DEMO_CLOCK_PRESETS,
  OPERATION_MODE_LABEL,
  confirmDemoBooking,
  errorText,
  fetchA2ALog,
  fetchDemoPersonas,
  fetchDemoState,
  formatMonthDayTime,
  injectDemoOutcomes,
  moveDemoClock,
  rejectProxyBooking,
  resetDemo,
  type OpsBooking,
} from "@/lib/ui-data/ops";
import { DemoControls } from "./controls";
import { LiveLog } from "./live-log";
import { SidePanel, type SideMode } from "./side-panel";

// The three-split view polls the server: the A2A log and the booking state change while the customer
// in the left frame talks to the agents.
const POLL_MS = 2000;

const inlineLink = cn("text-text underline", focusRing);

export function DemoConsole() {
  const personas = useApi(fetchDemoPersonas);
  const [following, setFollowing] = useState(true);
  const state = useApi(fetchDemoState, POLL_MS);
  const log = useApi(() => fetchA2ALog(), following ? POLL_MS : undefined);

  const [personaId, setPersonaId] = useState("yuki");
  // the left frame always shows a customer, so it keeps the last customer persona
  const [customerId, setCustomerId] = useState("yuki");
  const [sideMode, setSideMode] = useState<SideMode>("ops");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<ReactNode>(null);

  const list = personas.data?.personas ?? [];
  const customer = list.find((persona) => persona.id === customerId);
  const screenPath = customer?.path ?? "/ja/onboarding";
  const bookings = state.data?.bookings ?? [];
  const pending = bookings.filter((booking) => booking.status === "pending_clinic");

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } catch (failure) {
      setMessage(`실행하지 못했어요. ${errorText(failure)}`);
    } finally {
      setBusy(null);
      await Promise.all([state.reload(), log.reload()]);
    }
  };

  const selectPersona = (id: string) => {
    const persona = list.find((item) => item.id === id);
    if (!persona) return;
    setPersonaId(id);
    if (persona.kind === "customer") setCustomerId(id);
    if (persona.kind === "clinic") setSideMode("clinic");
    if (persona.kind === "operator") setSideMode("ops");
  };

  const reset = () =>
    run("reset", async () => {
      const result = await resetDemo();
      setPersonaId("yuki");
      setCustomerId("yuki");
      const total = Object.values(result.loaded).reduce((sum, n) => sum + n, 0);
      setMessage(`저장소를 시드 상태로 되돌렸어요 (${total}건). 로그와 대기 예약이 비었고 시계는 ${formatMonthDayTime(result.now)}이에요.`);
    });

  const inject = () =>
    run("inject", async () => {
      const result = await injectDemoOutcomes();
      setMessage(
        <>
          아라의원 일본 고객 결과 {result.injected}건을 주입했어요. 견적 대비 실결제가 평균 +{result.meanGapPct}%예요.{" "}
          <Link href="/ops/rules" className={inlineLink}>
            연결 규칙
          </Link>
          에서 [규칙 제안 실행]을 눌러 보세요.
        </>,
      );
    });

  const changeClock = (to: string) =>
    run("clock", async () => {
      const result = await moveDemoClock(to);
      const preset = DEMO_CLOCK_PRESETS.find((item) => Date.parse(item.value) === Date.parse(result.now));
      setMessage(`시계를 옮겼어요: ${formatMonthDayTime(result.now)}${preset ? ` (${preset.hint})` : ""}`);
    });

  const confirm = (booking: OpsBooking) =>
    run(`confirm:${booking.bookingId}`, async () => {
      const result = await confirmDemoBooking(booking.bookingId);
      setMessage(
        `${OPERATION_MODE_LABEL[result.operationMode]} 예약을 확정했어요. ${booking.clinicName} · ${booking.guest.displayName} (${
          result.confirmedBy === "pibu_operator" ? "병원 확인 뒤 운영자가 확정" : "병원이 확정"
        })`,
      );
    });

  const reject = (booking: OpsBooking) =>
    run(`reject:${booking.bookingId}`, async () => {
      await rejectProxyBooking(booking.bookingId);
      setMessage(`예약을 거절 처리했어요. ${booking.clinicName} · ${booking.guest.displayName}`);
    });

  return (
    <>
      <PageHeader
        title="데모 컨트롤"
        description="3분 데모를 진행하는 화면이에요. 버튼은 데모 API(DEMO_MODE)를 부르고, 가운데 로그와 오른쪽 예약은 서버에서 2초마다 다시 읽어요."
        action={
          <Link href="/ops/clinics" className={buttonStyles({ variant: "secondary" })}>
            운영 콘솔 열기
          </Link>
        }
      />

      <DemoControls
        personas={list}
        personaId={personaId}
        onPersona={selectPersona}
        clock={state.data?.now ?? ""}
        onClock={changeClock}
        injected={state.data?.injected ?? 0}
        onInject={inject}
        onReset={reset}
        pending={pending}
        onConfirm={confirm}
        busy={busy}
        message={message ?? (state.error ? `데모 상태를 불러오지 못했어요. ${state.error}` : null)}
      />

      <div className="ops-demo-grid">
        <section aria-label="고객 화면" className="flex flex-col gap-sp-2 md:row-span-2 xl:row-span-1">
          <div className="flex items-baseline justify-between gap-sp-3">
            <h2 className="text-title font-semi">고객 화면</h2>
            <span className="text-caption text-subtle">
              {customer?.label ?? "Yuki"} · {screenPath}
            </span>
          </div>
          <iframe
            key={screenPath}
            title={`고객 화면 ${customer?.label ?? "Yuki"}`}
            src={screenPath}
            className="ops-demo-phone rounded-card border border-border-soft bg-bg"
          />
        </section>

        <LiveLog entries={log.data?.entries ?? []} clinics={log.data?.clinics ?? {}} following={following} onFollow={setFollowing} error={log.error} />

        <SidePanel mode={sideMode} onMode={setSideMode} bookings={bookings} busy={busy} onConfirm={confirm} onReject={reject} />
      </div>
    </>
  );
}
