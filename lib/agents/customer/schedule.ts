import type { IsoDate, IsoDateTime } from "../../domain/common";
import { procedureFor } from "./procedures";

// Next session rules (06-data-model.md "다음 회차 계산", BUILD-LOG 13: calendar months).
//  - a series (`cycle.initial`) continues every initial.intervalDays until initial.count sessions;
//  - after that the next visit is maintenanceIntervalDays.min later;
//  - intervals that are whole multiples of 30 days are counted in calendar months (30 = 1 month,
//    90 = 3 months), so Rejuran on 11-14 comes back on 12-14 and a monthly series keeps its day of month.
//    Other intervals (14, 28 days) stay in days;
//  - the session number resets to 1 when the gap since the previous session is longer than
//    maintenanceIntervalDays.max x 1.5 (series only procedures use initial.intervalDays x 1.5).

const DAY_MS = 86_400_000;

function parseDate(date: IsoDate): [number, number, number] {
  return date.slice(0, 10).split("-").map(Number) as [number, number, number];
}

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Adds calendar months, clamping to the month's last day (01-31 + 1 month = 02-28). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = parseDate(date);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  const [y1, m1, d1] = parseDate(from);
  const [y2, m2, d2] = parseDate(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

export function addInterval(date: IsoDate, days: number): IsoDate {
  return days > 0 && days % 30 === 0 ? addMonths(date, days / 30) : addDays(date, days);
}

export interface SessionLike {
  procedureId: string;
  date: IsoDate;
  sessionNumber: number;
}

/** Gap after which a series starts over at session 1, or null when the procedure is unknown. */
function resetGapDays(procedureId: string): number | null {
  const procedure = procedureFor(procedureId);
  if (!procedure) return null;
  const max = procedure.cycle.maintenanceIntervalDays?.max ?? procedure.cycle.initial?.intervalDays;
  return max === undefined ? null : max * 1.5;
}

/** Session number of a session on `date`, given the previous session of the same procedure (if any). */
export function nextSessionNumber(previous: SessionLike | undefined, procedureId: string, date: IsoDate): number {
  if (!previous) return 1;
  const reset = resetGapDays(procedureId);
  if (reset !== null && daysBetween(previous.date, date) > reset) return 1;
  return previous.sessionNumber + 1;
}

/** When the next session is due after session `sessionNumber` on `date`. Undefined when nothing follows. */
export function computeNextDue(procedureId: string, date: IsoDate, sessionNumber: number): IsoDate | undefined {
  const procedure = procedureFor(procedureId);
  if (!procedure) return undefined;
  const { initial, maintenanceIntervalDays } = procedure.cycle;
  if (initial && (initial.count === null || sessionNumber < initial.count)) return addInterval(date, initial.intervalDays);
  if (maintenanceIntervalDays) return addInterval(date, maintenanceIntervalDays.min);
  return undefined;
}

/**
 * Recomputes session numbers and next due dates of one procedure series in date order, so a record added
 * out of order (a back-dated 3 second record) still yields the right numbering.
 */
export function renumberSeries<T extends SessionLike & { nextDue?: IsoDate }>(records: T[]): (T & { nextDue?: IsoDate })[] {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  let previous: SessionLike | undefined;
  return sorted.map((record) => {
    const sessionNumber = nextSessionNumber(previous, record.procedureId, record.date);
    const next = { ...record, sessionNumber, nextDue: computeNextDue(record.procedureId, record.date, sessionNumber) };
    previous = next;
    return next;
  });
}

/**
 * Departure downtime warning (06): procedure day + downtimeDays.max later than the departure date.
 * Only a warning, never a block (BUILD-LOG 14 covers the stay extension notice on the platform side).
 */
export function downtimeOverlapsDeparture(procedureId: string, slot: IsoDateTime, departure: IsoDate | undefined): boolean {
  if (!departure) return false;
  const downtime = procedureFor(procedureId)?.downtimeDays;
  if (!downtime) return false;
  return addDays(slot.slice(0, 10), downtime.max) > departure;
}

/** Check-in due times after a procedure day: D7 and D30 at 10:00 KST (in-app only, no external messaging). */
export function checkinDueAt(procedureDay: IsoDate, checkpoint: "D7" | "D30"): IsoDateTime {
  return `${addDays(procedureDay, checkpoint === "D7" ? 7 : 30)}T10:00:00+09:00`;
}
