// Pure helpers for the records tab: where each procedure stands against its recommended cycle,
// which procedures the customer does most, and month totals.

import type { IsoDate } from "@/lib/domain/common";
import { daysBetween, getProcedure, type ProcedureId, type TreatmentRecord } from "@/lib/ui-data/customer";

export type CarePoint =
  | { kind: "courseOnTrack"; done: number; count: number; next: number; days: number }
  | { kind: "courseLate"; done: number; count: number; since: number; late: number }
  | { kind: "early"; since: number; days: number }
  | { kind: "window"; since: number }
  | { kind: "late"; since: number; late: number };

/** Compares the latest session of a procedure with its recommended cycle (PROCEDURES[].cycle). */
export function carePoint(latest: TreatmentRecord, today: IsoDate): CarePoint | undefined {
  const procedure = getProcedure(latest.procedureId);
  if (!procedure || latest.status !== "active") return undefined;
  const since = daysBetween(latest.date, today);
  const { initial, maintenanceIntervalDays: window } = procedure.cycle;
  if (initial && latest.sessionNumber < initial.count) {
    const days = initial.intervalDays - since;
    const done = latest.sessionNumber;
    return days >= 0
      ? { kind: "courseOnTrack", done, count: initial.count, next: done + 1, days }
      : { kind: "courseLate", done, count: initial.count, since, late: -days };
  }
  if (since < window.min) return { kind: "early", since, days: window.min - since };
  if (since <= window.max) return { kind: "window", since };
  return { kind: "late", since, late: since - window.max };
}

export function isLate(point: CarePoint | undefined): boolean {
  return point?.kind === "courseLate" || point?.kind === "late";
}

export type ProcedureSummary = {
  procedureId: ProcedureId;
  count: number;
  totalKrw: number;
  first: TreatmentRecord;
  last: TreatmentRecord;
};

/** One row per procedure, most sessions first, then most recent. */
export function procedureSummaries(records: TreatmentRecord[]): ProcedureSummary[] {
  const byProcedure = new Map<ProcedureId, TreatmentRecord[]>();
  for (const record of [...records].sort((a, b) => a.date.localeCompare(b.date))) {
    byProcedure.set(record.procedureId, [...(byProcedure.get(record.procedureId) ?? []), record]);
  }
  return [...byProcedure.entries()]
    .map(([procedureId, list]) => ({
      procedureId,
      count: list.length,
      totalKrw: list.reduce((sum, r) => sum + (r.priceKrw ?? 0), 0),
      first: list[0] as TreatmentRecord,
      last: list[list.length - 1] as TreatmentRecord,
    }))
    .sort((a, b) => b.count - a.count || b.last.date.localeCompare(a.last.date));
}

export type MonthGroup = { month: string; records: TreatmentRecord[]; totalKrw: number };

/** Records grouped by "YYYY-MM", newest month first; records inside keep the given order. */
export function monthGroups(records: TreatmentRecord[]): MonthGroup[] {
  const groups = new Map<string, TreatmentRecord[]>();
  for (const record of records) {
    const month = record.date.slice(0, 7);
    groups.set(month, [...(groups.get(month) ?? []), record]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([month, list]) => ({ month, records: list, totalKrw: list.reduce((sum, r) => sum + (r.priceKrw ?? 0), 0) }));
}
