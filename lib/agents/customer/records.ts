import type { Amount, IsoDate, Krw, TreatmentRecord } from "../../domain";
import { getProcedure } from "../../domain/procedure-master";
import { clinicIdByName } from "./clinic-names";
import { numberSeries } from "./schedule";
import { customerStore, newId } from "./store";

// "내 시술 기록" (02 1절): records from bookings (automatic), the 3 second manual record and the memo import.
// Session numbers and next due dates are always recomputed for the whole series of a procedure (schedule.ts),
// so a record added in the past renumbers the ones after it.

export interface RecordInput {
  procedureId: string;
  date: IsoDate;
  amount?: Amount;
  priceKrw?: Krw;
  /** A registry clinic id, or a free text name that is matched against the registry. */
  clinicId?: string;
  clinicName?: string;
  rating?: TreatmentRecord["rating"];
  note?: string;
  source?: TreatmentRecord["source"];
  sharedToPlatform?: boolean;
}

/** Every record of the customer, newest first. */
export async function listRecords(customerId: string): Promise<TreatmentRecord[]> {
  const records = await customerStore.records(customerId);
  return records.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

/** Recomputes sessionNumber and nextDue for every record of one procedure and stores the changed ones. */
export async function renumberSeries(customerId: string, procedureId: string): Promise<TreatmentRecord[]> {
  const series = (await customerStore.records(customerId)).filter((r) => r.procedureId === procedureId);
  const numbers = new Map(numberSeries(procedureId, series).map((n) => [n.id, n]));
  const out: TreatmentRecord[] = [];
  for (const record of series) {
    const n = numbers.get(record.id)!;
    const next: TreatmentRecord = { ...record, sessionNumber: n.sessionNumber };
    if (n.nextDue) next.nextDue = n.nextDue;
    else delete next.nextDue;
    if (next.sessionNumber !== record.sessionNumber || next.nextDue !== record.nextDue) await customerStore.putRecord(next);
    out.push(next);
  }
  return out;
}

/** Stores a record (manual by default) and renumbers its series. Returns the stored record. */
export async function addRecord(customerId: string, input: RecordInput, id: string = newId("rec")): Promise<TreatmentRecord> {
  if (!getProcedure(input.procedureId)) throw new Error(`unknown procedure ${input.procedureId}`);
  const clinicId = input.clinicId ?? (input.clinicName ? clinicIdByName(input.clinicName) : undefined);
  const record: TreatmentRecord = {
    id,
    customerId,
    procedureId: input.procedureId,
    date: input.date,
    ...(input.amount ? { amount: input.amount } : {}),
    ...(input.priceKrw !== undefined ? { priceKrw: input.priceKrw } : {}),
    ...(clinicId ? { clinicId } : {}),
    ...(!clinicId && input.clinicName ? { clinicName: input.clinicName } : {}),
    source: input.source ?? "manual",
    ...(input.rating ? { rating: input.rating } : {}),
    ...(input.note ? { note: input.note } : {}),
    sessionNumber: 1,
    status: "active",
    sharedToPlatform: input.sharedToPlatform ?? false,
  };
  await customerStore.putRecord(record);
  const series = await renumberSeries(customerId, record.procedureId);
  return series.find((r) => r.id === id)!;
}

/** Changes a stored record (status, rating, amounts) and renumbers its series. */
export async function updateRecord(id: string, patch: Partial<Omit<TreatmentRecord, "id" | "customerId">>): Promise<TreatmentRecord> {
  const record = await customerStore.record(id);
  if (!record) throw new Error(`no record ${id}`);
  await customerStore.putRecord({ ...record, ...patch });
  const series = await renumberSeries(record.customerId, patch.procedureId ?? record.procedureId);
  if (patch.procedureId && patch.procedureId !== record.procedureId) await renumberSeries(record.customerId, record.procedureId);
  return series.find((r) => r.id === id)!;
}

/**
 * Records a clinic confirmed: a booking of this app, or a visit anchored on chain. Only these go into the ZK
 * chart; a manual record is never used to claim an offer (INTEGRATION 6).
 */
export const isClinicConfirmed = (record: TreatmentRecord): boolean =>
  record.anchor !== undefined || (record.clinicId !== undefined && record.source === "booking");
