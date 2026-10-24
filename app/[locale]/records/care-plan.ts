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
  procedureId: string;
  count: number;
  totalKrw: number;
  first: TreatmentRecord;
  last: TreatmentRecord;
};

/** One row per procedure, most sessions first, then most recent. */
export function procedureSummaries(records: TreatmentRecord[]): ProcedureSummary[] {
  const byProcedure = new Map<string, TreatmentRecord[]>();
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

// Treated area per procedure, for the history presets. Records carry no area yet, so this is the
// demo default for each procedure (a record-level field can override it later).
export type BodyArea = "forehead" | "full_face" | "jawline";

const PROCEDURE_AREA: Record<ProcedureId, BodyArea> = {
  rejuran_healer: "full_face",
  thermage_flx: "full_face",
  ulthera: "jawline",
  botox_forehead: "forehead",
  shrink_universe: "jawline",
  skin_booster_juvelook: "full_face",
};

/** Undefined for master procedures outside the six screen procedures (no area preset for them). */
export function recordArea(record: TreatmentRecord): BodyArea | undefined {
  return PROCEDURE_AREA[record.procedureId as ProcedureId];
}

/** Clinic key of a record: the registry id, or the typed name for clinics outside the registry. */
export function recordClinic(record: TreatmentRecord): string | undefined {
  return record.clinicId ?? (record.clinicName ? `name:${record.clinicName}` : undefined);
}

/** The values the customer used most (up to `limit`), most frequent first, then most recent. */
export function topValues(records: TreatmentRecord[], key: (r: TreatmentRecord) => string | undefined, limit = 5): string[] {
  const stats = new Map<string, { count: number; last: string }>();
  for (const record of records) {
    const value = key(record);
    if (!value) continue;
    const prev = stats.get(value);
    stats.set(value, { count: (prev?.count ?? 0) + 1, last: prev && prev.last > record.date ? prev.last : record.date });
  }
  return [...stats.entries()]
    .sort(([, a], [, b]) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, limit)
    .map(([value]) => value);
}
