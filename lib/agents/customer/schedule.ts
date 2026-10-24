import type { IsoDate, IsoDateTime } from "../../domain";
import { getProcedure } from "../../domain/procedure-master";
import { PROCEDURE_DEFAULTS } from "./procedure-defaults";

// Next session math (06 "다음 회차 계산", BUILD-LOG 13 and 14). Pure: dates in, dates out.
//
// - An interval that is a whole number of 30 day months is added as calendar months (30 -> 1 month, 90 -> 3,
//   300 -> 10), clamped to the last day of a shorter month (01-31 + 1 month = 02-28). Other intervals are days.
// - While `sessionNumber < initial.count` the next session is `initial.intervalDays` away, after that
//   `maintenanceIntervalDays.min`.
// - A session continues the series of the previous record of the same procedure unless the gap is longer than
//   `maintenanceIntervalDays.max` (or `initial.intervalDays * 2` without one): then the series starts again at 1.
// - Downtime that runs past the departure date is a warning, never a block (06, BUILD-LOG 14).

export interface ScheduleFacts {
  initial?: { count: number | null; intervalDays: number };
  maintenanceIntervalDays?: { min: number; max: number };
  downtimeDays?: { min: number; max: number };
}

/** Cycle and downtime of a procedure: the shared master, with 06 defaults where the master has null. */
export function scheduleFacts(procedureId: string): ScheduleFacts | undefined {
  const master = getProcedure(procedureId);
  const defaults = PROCEDURE_DEFAULTS[procedureId];
  if (!master && !defaults) return undefined;
  const masterInitial = master?.cycle.initial;
  const initial =
    masterInitial && masterInitial.count === null && defaults?.cycle.initial ? defaults.cycle.initial : (masterInitial ?? defaults?.cycle.initial);
  const maintenance = master?.cycle.maintenanceIntervalDays ?? defaults?.cycle.maintenanceIntervalDays;
  const downtime = master?.downtimeDays ?? defaults?.downtimeDays;
  return {
    ...(initial ? { initial } : {}),
    ...(maintenance ? { maintenanceIntervalDays: maintenance } : {}),
    ...(downtime ? { downtimeDays: downtime } : {}),
  };
}

// ---- date math on YYYY-MM-DD (UTC calendar, no time zone involved) ----

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const parts = (date: IsoDate): [number, number, number] => {
  const [y, m, d] = date.split("-").map(Number);
  return [y!, m!, d!];
};

export function addDays(date: IsoDate, days: number): IsoDate {
  const [y, m, d] = parts(date);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Calendar months; a day the target month does not have becomes its last day. */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const [y, m, d] = parts(date);
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10);
}

/** Whole months for multiples of 30 days (BUILD-LOG 13), days otherwise. */
export function addInterval(date: IsoDate, days: number): IsoDate {
  return days > 0 && days % 30 === 0 ? addMonths(date, days / 30) : addDays(date, days);
}

/** Days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(to);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY_MS);
}

/** The Seoul calendar date of a slot such as 2026-11-14T11:00:00+09:00. */
export const seoulDate = (at: IsoDateTime | IsoDate): IsoDate =>
  at.length === 10 ? at : new Date(Date.parse(at) + KST_OFFSET_MS).toISOString().slice(0, 10);

// ---- sessions ----

/** The gap after which a series counts as broken. Undefined means it never breaks. */
export function seriesBreakDays(facts: ScheduleFacts): number | undefined {
  return facts.maintenanceIntervalDays?.max ?? (facts.initial ? facts.initial.intervalDays * 2 : undefined);
}

/** Session number of a procedure on `date`, given the previous session of the same procedure (if any). */
export function sessionNumberFor(
  procedureId: string,
  date: IsoDate,
  previous: { date: IsoDate; sessionNumber: number } | undefined,
): number {
  if (!previous) return 1;
  const facts = scheduleFacts(procedureId);
  const limit = facts ? seriesBreakDays(facts) : undefined;
  if (limit !== undefined && daysBetween(previous.date, date) > limit) return 1;
  return previous.sessionNumber + 1;
}

/** When the session after this one is due, or undefined when the procedure has no cycle. */
export function nextDueFor(procedureId: string, date: IsoDate, sessionNumber: number): IsoDate | undefined {
  const facts = scheduleFacts(procedureId);
  if (!facts) return undefined;
  const { initial, maintenanceIntervalDays } = facts;
  if (initial && initial.count !== null && sessionNumber < initial.count) return addInterval(date, initial.intervalDays);
  if (maintenanceIntervalDays) return addInterval(date, maintenanceIntervalDays.min);
  if (initial) return addInterval(date, initial.intervalDays);
  return undefined;
}

export interface SeriesEntry {
  id: string;
  date: IsoDate;
}

/**
 * Session numbers and next due dates for every record of ONE procedure, oldest first. Records on the same day
 * keep their id order. Returns one entry per input record.
 */
export function numberSeries(procedureId: string, records: readonly SeriesEntry[]): Array<{ id: string; sessionNumber: number; nextDue?: IsoDate }> {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const out: Array<{ id: string; sessionNumber: number; nextDue?: IsoDate }> = [];
  let previous: { date: IsoDate; sessionNumber: number } | undefined;
  for (const record of sorted) {
    const sessionNumber = sessionNumberFor(procedureId, record.date, previous);
    const nextDue = nextDueFor(procedureId, record.date, sessionNumber);
    out.push({ id: record.id, sessionNumber, ...(nextDue ? { nextDue } : {}) });
    previous = { date: record.date, sessionNumber };
  }
  return out;
}

// ---- downtime before the flight home ----

export interface DowntimeWarning {
  procedureId: string;
  /** Last day of the longest downtime. */
  downtimeEndsOn: IsoDate;
  departure: IsoDate;
  /** Days the downtime runs past the departure date. */
  daysOver: number;
}

/**
 * A warning when the procedure day plus the longest downtime is after the departure date (06). The screen shows
 * "출국 전에 다운타임이 끝나지 않을 수 있어요" and suggests checking whether the stay can be extended (BUILD-LOG 14).
 */
export function downtimeWarning(procedureId: string, slot: IsoDateTime | IsoDate, departure: IsoDate): DowntimeWarning | undefined {
  const max = scheduleFacts(procedureId)?.downtimeDays?.max;
  if (max === undefined) return undefined;
  const downtimeEndsOn = addDays(seoulDate(slot), max);
  if (downtimeEndsOn <= departure) return undefined;
  return { procedureId, downtimeEndsOn, departure, daysOver: daysBetween(departure, downtimeEndsOn) };
}
