"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { buttonStyles } from "@/components/ui";
import { PageHeader } from "@/components/ops";
import { cn } from "@/lib/cn";
import { focusRing } from "@/lib/ui";
import {
  A2A_LOG,
  DEMO_CLOCK_PRESETS,
  DEMO_PERSONAS,
  OPERATION_MODE_LABEL,
  OPS_NOW,
  YUKI_BOOKING_STEP,
  YUKI_CONTEXT_ID,
  buildDemoBookings,
  clinicName,
  customerScreenPath,
  readOutcomesInjected,
  writeOutcomesInjected,
  type DemoBooking,
} from "@/lib/ui-data/ops";
import { confirmBooking, injectOutcomes, moveClock, resetSeed } from "./demo-api";
import { DemoControls } from "./controls";
import { LiveLog } from "./live-log";
import { SidePanel, type SideMode } from "./side-panel";

// Yuki's calls in order: the first YUKI_BOOKING_STEP happen before the booking exists, the rest come after
// it is confirmed: platform.report_booking from the clinic, then platform.anchor_record on the procedure day.
const YUKI_FLOW = A2A_LOG.filter((entry) => entry.contextId === YUKI_CONTEXT_ID);
const YUKI_BOOKING_ID = "bk_demo_yuki";
// Time between two replayed calls, slow enough to follow on screen.
const REPLAY_STEP_MS = 700;

const inlineLink = cn("text-text underline", focusRing);

export function DemoConsole() {
  const [personaId, setPersonaId] = useState("yuki");
  // the left frame always shows a customer, so it keeps the last customer persona
  const [customerId, setCustomerId] = useState("yuki");
  const [sideMode, setSideMode] = useState<SideMode>("ops");
  const [clock, setClock] = useState(OPS_NOW);
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [injected, setInjected] = useState(false);
  const [bookings, setBookings] = useState<DemoBooking[]>(buildDemoBookings);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<ReactNode>(null);

  // /ops/rules reads the same flag, so coming back to this page keeps the injected state
  useEffect(() => {
    setInjected(readOutcomesInjected());
  }, []);

  useEffect(() => {
    if (!playing) return;
    if (shown >= YUKI_BOOKING_STEP) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setShown((count) => count + 1), REPLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [playing, shown]);

  const customer = DEMO_PERSONAS.find((persona) => persona.id === customerId) ?? DEMO_PERSONAS[0];
  const screenPath = customerScreenPath(customer);

  const visible = bookings.filter((booking) => booking.revealAtStep === undefined || shown >= booking.revealAtStep);
  const pending = visible.filter((booking) => booking.state === "pending");
  const yukiConfirmed = bookings.some((booking) => booking.id === YUKI_BOOKING_ID && booking.state === "confirmed");
  // calls after the booking wait for the demo clock to reach their day (timestamps carry +09:00, so the date slices compare)
  const after = yukiConfirmed ? YUKI_FLOW.slice(YUKI_BOOKING_STEP).filter((entry) => entry.at.slice(0, 10) <= clock.slice(0, 10)) : [];
  const entries = [...YUKI_FLOW.slice(0, shown), ...after];

  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  };

  const setBookingState = (id: string, state: DemoBooking["state"]) =>
    setBookings((current) => current.map((booking) => (booking.id === id ? { ...booking, state } : booking)));

  const selectPersona = (id: string) => {
    const persona = DEMO_PERSONAS.find((item) => item.id === id);
    if (!persona) return;
    setPersonaId(id);
    if (persona.kind === "customer") setCustomerId(id);
    if (persona.kind === "clinic") setSideMode("clinic");
    if (persona.kind === "operator") setSideMode("ops");
  };

  const reset = () =>
    run("reset", async () => {
      await resetSeed();
      writeOutcomesInjected(false);
      setPlaying(false);
      setShown(0);
      setBookings(buildDemoBookings());
      setInjected(false);
      setClock(OPS_NOW);
      setPersonaId("yuki");
      setCustomerId("yuki");
      setMessage("저장소를 시드 상태로 되돌렸어요. 로그와 대기 예약이 비었고 시계는 11/12 10:00이에요.");
    });

  const inject = () =>
    run("inject", async () => {
      if (injected) {
        setMessage("이미 주입했어요. 시드 리셋 후에 다시 주입할 수 있어요.");
        return;
      }
      const result = await injectOutcomes();
      writeOutcomesInjected(true);
      setInjected(true);
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
      const result = await moveClock(to);
      setClock(result.now);
      const preset = DEMO_CLOCK_PRESETS.find((item) => item.value === result.now);
      setMessage(`시계를 옮겼어요: ${preset?.label ?? result.now}${preset ? ` (${preset.hint})` : ""}`);
    });

  const confirm = (booking: DemoBooking) =>
    run(`confirm:${booking.id}`, async () => {
      const result = await confirmBooking(booking);
      setBookingState(booking.id, "confirmed");
      setMessage(
        `${OPERATION_MODE_LABEL[booking.mode]} 예약을 확정했어요. ${clinicName(booking.clinicId)} · ${booking.guestName} (${
          result.confirmedBy === "pibu_operator" ? "병원 확인 뒤 운영자가 확정" : "병원이 확정"
        })`,
      );
    });

  const reject = (booking: DemoBooking) => {
    setBookingState(booking.id, "rejected");
    setMessage(`예약을 거절했어요. ${clinicName(booking.clinicId)} · ${booking.guestName}`);
  };

  const propose = (booking: DemoBooking) => {
    setBookingState(booking.id, "proposed");
    setMessage(`다른 시간을 제안했어요. ${clinicName(booking.clinicId)} · ${booking.guestName}`);
  };

  return (
    <>
      <PageHeader
        title="데모 컨트롤"
        description="3분 데모를 진행하는 화면이에요. 지금은 목업이라 API 대신 이 화면 안에서 동작해요."
        action={
          <div className="flex flex-wrap gap-sp-2">
            <Link href="/demo/ledger" className={buttonStyles({ variant: "secondary" })}>
              공개 원장
            </Link>
            <Link href="/ops/clinics" className={buttonStyles({ variant: "secondary" })}>
              운영 콘솔 열기
            </Link>
          </div>
        }
      />

      <DemoControls
        personaId={personaId}
        onPersona={selectPersona}
        clock={clock}
        onClock={changeClock}
        injected={injected}
        onInject={inject}
        onReset={reset}
        pending={pending}
        onConfirm={confirm}
        busy={busy}
        message={message}
      />

      <div className="ops-demo-grid">
        <section aria-label="고객 화면" className="flex flex-col gap-sp-2 md:row-span-2 xl:row-span-1">
          <div className="flex items-baseline justify-between gap-sp-3">
            <h2 className="text-title font-semi">고객 화면</h2>
            <span className="text-caption text-subtle">
              {customer.label} · {screenPath}
            </span>
          </div>
          <iframe
            key={screenPath}
            title={`고객 화면 ${customer.label}`}
            src={screenPath}
            className="ops-demo-phone rounded-card border border-border-soft bg-bg"
          />
        </section>

        <LiveLog entries={entries} shown={shown} steps={YUKI_BOOKING_STEP} playing={playing} onPlay={() => setPlaying(true)} />

        <SidePanel
          mode={sideMode}
          onMode={setSideMode}
          bookings={visible}
          busy={busy}
          onConfirm={confirm}
          onReject={reject}
          onPropose={propose}
        />
      </div>
    </>
  );
}
