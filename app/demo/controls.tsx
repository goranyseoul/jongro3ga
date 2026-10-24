"use client";

import type { ReactNode } from "react";
import { Button, Card, ChipGroup, Stat } from "@/components/ui";
import {
  DEMO_CLOCK_PRESETS,
  DEMO_PERSONAS,
  OPERATION_MODE_LABEL,
  clinicName,
  formatMonthDayTime,
  type DemoBooking,
} from "@/lib/ui-data/ops";

export type ControlsProps = {
  personaId: string;
  onPersona: (id: string) => void;
  clock: string;
  onClock: (value: string) => void;
  injected: boolean;
  onInject: () => void;
  onReset: () => void;
  /** Bookings waiting for a confirmation, proxy and direct. */
  pending: DemoBooking[];
  onConfirm: (booking: DemoBooking) => void;
  /** Key of the action in flight, or null. Buttons are disabled while one runs. */
  busy: string | null;
  message: ReactNode;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-sp-3">
      <h2 className="text-title font-semi">{title}</h2>
      {children}
    </section>
  );
}

export function DemoControls({
  personaId,
  onPersona,
  clock,
  onClock,
  injected,
  onInject,
  onReset,
  pending,
  onConfirm,
  busy,
  message,
}: ControlsProps) {
  const persona = DEMO_PERSONAS.find((item) => item.id === personaId) ?? DEMO_PERSONAS[0];
  const preset = DEMO_CLOCK_PRESETS.find((item) => item.value === clock);

  return (
    <Card className="flex flex-col gap-sp-6">
      <p role="status" aria-live="polite" className={message ? "text-body text-muted" : "sr-only"}>
        {message}
      </p>

      <Section title="페르소나">
        <ChipGroup
          label="페르소나 전환"
          value={personaId}
          onChange={onPersona}
          options={DEMO_PERSONAS.map((item) => ({ value: item.id, label: item.label }))}
        />
        <p className="text-label text-muted">{persona.hint}</p>
      </Section>

      <div className="grid gap-sp-6 lg:grid-cols-3">
        <Section title="시계">
          <Stat label="현재 시계" value={preset ? preset.label : clock} caption={preset?.hint} />
          <ChipGroup
            label="시계 이동"
            value={clock}
            onChange={onClock}
            options={DEMO_CLOCK_PRESETS.map((item) => ({ value: item.value, label: item.label }))}
          />
        </Section>

        <Section title="데이터">
          <div className="flex flex-col gap-sp-2 sm:flex-row lg:flex-col xl:flex-row">
            <Button variant="secondary" onClick={onReset} disabled={busy !== null}>
              시드 리셋
            </Button>
            <Button onClick={onInject} disabled={busy !== null}>
              결과 20건 주입
            </Button>
          </div>
          <p className="text-label text-muted">
            {injected ? "아라의원 일본 고객 결과 20건이 들어 있어요." : "아라의원 일본 고객 결과 20건을 아직 주입하지 않았어요."}
          </p>
        </Section>

        <Section title="예약 확정">
          {pending.length === 0 ? (
            <p className="text-label text-muted">대기 중인 예약이 없어요.</p>
          ) : (
            <ul className="flex flex-col">
              {pending.map((booking) => (
                <li key={booking.id} className="flex flex-col gap-sp-2 border-b border-border-soft py-sp-3 first:pt-0 last:border-b-0 last:pb-0">
                  <div className="flex flex-col gap-sp-1">
                    <span className="text-body">
                      <span className="font-med">{OPERATION_MODE_LABEL[booking.mode]}</span> · {clinicName(booking.clinicId)} · {booking.guestName}
                    </span>
                    <span className="text-caption text-subtle tabular-nums">
                      {booking.summary} · {formatMonthDayTime(booking.slot)}
                    </span>
                  </div>
                  <Button variant="secondary" onClick={() => onConfirm(booking)} disabled={busy !== null}>
                    예약 확정
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </Card>
  );
}
