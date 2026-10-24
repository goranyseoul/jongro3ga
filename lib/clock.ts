import type { IsoDate, IsoDateTime } from "./domain/common";
import { pibuGlobals } from "./pibu-globals";

// The only place that reads the time. Every "last N days", offer validity, freshness and check-in
// calculation uses `clock.now()`, never Date.now() (06-data-model.md "시계").
//
// Demo mode (DEMO_MODE=true) runs a fixed clock that only moves through setClock (the demo control's
// "시계 이동"), so the demo replays the same way every time. Otherwise it is the real time.

/**
 * Start of every demo run: Saturday 2026-10-24, the day the planner's memo was saved and the day of the
 * presentation. The scenarios in DEMO.md are laid out around it (see docs/spec/BUILD-LOG.md).
 */
export const DEFAULT_DEMO_NOW: IsoDateTime = "2026-10-24T10:00:00+09:00";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

function demoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

function parse(at: string | Date): number {
  const ms = typeof at === "string" ? Date.parse(at) : at.getTime();
  if (Number.isNaN(ms)) throw new TypeError(`not a valid time: ${String(at)}`);
  return ms;
}

function demoStart(): number {
  return parse(process.env.DEMO_NOW || DEFAULT_DEMO_NOW);
}

export const clock = {
  now(): Date {
    if (!demoMode()) return new Date();
    return new Date(pibuGlobals().clockAt ?? demoStart());
  },

  /** Current time as ISO 8601 with the +09:00 offset used everywhere in the data model. */
  nowIso(): IsoDateTime {
    const kst = new Date(this.now().getTime() + KST_OFFSET_MS);
    return `${kst.toISOString().slice(0, 19)}+09:00`;
  },

  /** Today's date in Korea. A time near midnight UTC is still the previous or next day in Seoul. */
  today(): IsoDate {
    return new Date(this.now().getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
  },
};

/**
 * Fixes the clock at `at`. Outside demo mode this only matters for tests that turn demo mode on.
 * Time may move forward or backward: tests need both, and the demo only uses forward jumps.
 */
export function setClock(at: string | Date): void {
  pibuGlobals().clockAt = parse(at);
}

/** Back to the start of the demo (DEMO_NOW or the default). */
export function resetClock(): void {
  delete pibuGlobals().clockAt;
}

/** Moves a fixed clock forward by whole hours, e.g. "다음 날 아침". */
export function advanceClockHours(hours: number): void {
  const current = clock.now().getTime();
  setClock(new Date(current + hours * HOUR_MS));
}
