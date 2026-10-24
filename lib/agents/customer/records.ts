import type { Amount, IsoDate } from "../../domain/common";
import type { TreatmentRecord } from "../../domain/customer";
import type { Store } from "../../store/types";
import { consentsOf, mayShareOutcome } from "./consent";
import { masterProcedureId, sameProcedure } from "./procedures";
import { renumberSeries } from "./schedule";
import { C, NS, listOf, getOf, newId } from "./store";

// "내 시술 기록" (02): booked procedures are recorded automatically at D0, the rest by the 3 second record.
// Session numbers and next due dates always come from schedule.ts, recomputed for the whole series.

export interface RecordInput {
  procedureId: string;
  date: IsoDate;
  amount?: Amount;
  priceKrw?: number;
  clinicId?: string;
  clinicName?: string;
  rating?: TreatmentRecord["rating"];
  note?: string;
}

export interface RecordPatch {
  status?: TreatmentRecord["status"];
  stopReason?: TreatmentRecord["stopReason"];
  rating?: TreatmentRecord["rating"];
  note?: string;
  date?: IsoDate;
  amount?: Amount;
  priceKrw?: number;
}

export async function listRecords(store: Store, customerId: string): Promise<TreatmentRecord[]> {
  const records = await listOf<TreatmentRecord>(store, C.records, { customerId });
  return records.sort((a, b) => b.date.localeCompare(a.date) || b.sessionNumber - a.sessionNumber);
}

/** Recomputes sessionNumber and nextDue for every record of the procedure series of `procedureId`. */
export async function renumber(store: Store, customerId: string, procedureId: string): Promise<void> {
  const series = (await listOf<TreatmentRecord>(store, C.records, { customerId })).filter((r) => sameProcedure(r.procedureId, procedureId));
  for (const record of renumberSeries(series)) await store.put(NS, C.records, record);
}

export async function addRecord(
  store: Store,
  customerId: string,
  input: RecordInput,
  options: { id?: string; source?: TreatmentRecord["source"]; sharedToPlatform?: boolean } = {},
): Promise<TreatmentRecord> {
  const shares = options.sharedToPlatform ?? mayShareOutcome(await consentsOf(store, customerId));
  const record: TreatmentRecord = {
    id: options.id ?? newId("rec"),
    customerId,
    procedureId: masterProcedureId(input.procedureId),
    date: input.date,
    ...(input.amount ? { amount: input.amount } : {}),
    ...(input.priceKrw !== undefined ? { priceKrw: input.priceKrw } : {}),
    ...(input.clinicId ? { clinicId: input.clinicId } : {}),
    ...(input.clinicName ? { clinicName: input.clinicName } : {}),
    source: options.source ?? "manual",
    ...(input.rating ? { rating: input.rating } : {}),
    ...(input.note ? { note: input.note } : {}),
    sessionNumber: 1,
    status: "active",
    sharedToPlatform: shares,
  };
  await store.put(NS, C.records, record);
  await renumber(store, customerId, record.procedureId);
  return (await getOf<TreatmentRecord>(store, C.records, record.id)) as TreatmentRecord;
}

export async function updateRecord(store: Store, customerId: string, id: string, patch: RecordPatch): Promise<TreatmentRecord | undefined> {
  const record = await getOf<TreatmentRecord>(store, C.records, id);
  if (!record || record.customerId !== customerId) return undefined;
  const next: TreatmentRecord = { ...record, ...stripUndefined(patch) };
  if (next.status !== "stopped") delete next.stopReason;
  await store.put(NS, C.records, next);
  if (patch.date !== undefined) await renumber(store, customerId, next.procedureId);
  return getOf<TreatmentRecord>(store, C.records, id);
}

export async function deleteRecord(store: Store, customerId: string, id: string): Promise<boolean> {
  const record = await getOf<TreatmentRecord>(store, C.records, id);
  if (!record || record.customerId !== customerId) return false;
  await store.remove(NS, C.records, id);
  await renumber(store, customerId, record.procedureId);
  return true;
}

/** The newest active record of each procedure with a next due date, soonest first (home "다음 회차"). */
export function upcomingDue(records: TreatmentRecord[]): TreatmentRecord[] {
  const latest = new Map<string, TreatmentRecord>();
  for (const r of [...records].sort((a, b) => a.date.localeCompare(b.date))) latest.set(masterProcedureId(r.procedureId), r);
  return [...latest.values()]
    .filter((r) => r.nextDue && r.status === "active")
    .sort((a, b) => (a.nextDue as string).localeCompare(b.nextDue as string));
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}
