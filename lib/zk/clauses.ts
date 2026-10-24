import type { ZkClause } from "../a2a/schemas";
import type { ZkChart } from "../domain/zk";
import { clinicCode, procedureCode } from "./codes";

export type { ZkChart };

/** Chart slots and the "no upper bound on age" day count, same as chain/records.mjs. */
export const N = 8;
export const FOREVER = 100000;

/** The clause as the eligibility circuit sees it: numbers only, 0 type/clinic means any. */
export interface CircuitClause {
  target_type: number;
  target_clinic: number;
  min_days: number;
  max_days: number;
  min_count: number;
  max_count: number;
}

export function toCircuitClause(clause: ZkClause): CircuitClause {
  return {
    target_type: clause.type === undefined ? 0 : procedureCode(clause.type),
    target_clinic: clause.clinicId === undefined ? 0 : clinicCode(clause.clinicId),
    min_days: clause.minDays ?? 0,
    max_days: clause.maxDays ?? FOREVER,
    min_count: clause.minCount ?? 0,
    max_count: clause.maxCount ?? N,
  };
}

/** The predicate the circuit enforces (chain/records.mjs clauseHolds), evaluated on the device. */
export function clauseHolds(chart: ZkChart, today: number, clause: ZkClause): boolean {
  const c = toCircuitClause(clause);
  let count = 0;
  for (let i = 0; i < N; i++) {
    const date = chart.dates[i] ?? 0;
    const type = chart.types[i] ?? 0;
    if (
      type !== 0 &&
      (c.target_type === 0 || type === c.target_type) &&
      (c.target_clinic === 0 || chart.clinics[i] === c.target_clinic) &&
      date + c.min_days <= today &&
      today <= date + c.max_days
    ) {
      count += 1;
    }
  }
  return c.min_count <= count && count <= c.max_count;
}

/** An offer applies when every one of its clauses holds. */
export function offerEligible(chart: ZkChart, today: number, clauses: readonly ZkClause[]): boolean {
  return clauses.every((clause) => clauseHolds(chart, today, clause));
}

/** Structured description of a clause for UI i18n. No prose here, the UI owns the wording. */
export interface ClauseDescriptor {
  kind: "first_visit" | "none_within" | "exact_count" | "min_count" | "max_count" | "range";
  procedureId?: string;
  clinicId?: string;
  count?: number;
  minCount?: number;
  maxCount?: number;
  maxDays?: number;
}

export function describeClause(clause: ZkClause): ClauseDescriptor {
  const target = {
    ...(clause.type === undefined ? {} : { procedureId: clause.type }),
    ...(clause.clinicId === undefined ? {} : { clinicId: clause.clinicId }),
    ...(clause.maxDays !== undefined && clause.maxDays < FOREVER ? { maxDays: clause.maxDays } : {}),
  };
  const windowed = target.maxDays !== undefined;
  const min = clause.minCount ?? 0;
  const max = clause.maxCount;

  if (max === 0) return { kind: windowed ? "none_within" : "first_visit", ...target };
  if (max !== undefined && min === max) return { kind: "exact_count", ...target, count: min };
  if (max === undefined) return { kind: "min_count", ...target, minCount: min };
  if (min === 0) return { kind: "max_count", ...target, maxCount: max };
  return { kind: "range", ...target, minCount: min, maxCount: max };
}

/** No record at this clinic yet. */
export const firstVisit = (clinicId: string): ZkClause => ({ clinicId, maxCount: 0 });

/** The n-th session of a procedure: exactly n-1 earlier sessions anywhere. */
export const nthSession = (procedureId: string, n: number): ZkClause => ({
  type: procedureId,
  minCount: n - 1,
  maxCount: n - 1,
});

/** At least `min` sessions of a procedure. */
export const loyal = (procedureId: string, min: number): ZkClause => ({ type: procedureId, minCount: min });
