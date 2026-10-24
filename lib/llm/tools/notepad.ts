import { z } from "zod";
import { AmountSchema, IsoDateSchema, KrwSchema } from "../../a2a/schemas";
import { BodyPartSchema } from "../../domain/procedure";
import { ProcedureIdOrUnknownSchema, TimeSchema } from "./common";

// "메모장 가져오기" (HANDOFF 3.1 and 6, DEMO.md scenario 2 ①): a pasted phone memo becomes treatment records,
// passes, appointments, body observations and the questions the agent must ask back (year guesses above all).
// Nothing here is saved until the customer confirms; WP6 turns `records` into TreatmentRecord with
// source "manual" and computes nextDue itself.

export const NotepadRecordSchema = z.strictObject({
  procedureId: ProcedureIdOrUnknownSchema,
  /** The procedure as the memo wrote it, e.g. "아이리쥬란". */
  procedureText: z.string().trim().min(1),
  date: IsoDateSchema,
  /** "month" when the memo has no day ("9월"): `date` is then the first of the month. */
  datePrecision: z.enum(["day", "month"]),
  /** True when the memo had no year and it was guessed from the order of the lines. */
  yearInferred: z.boolean(),
  amount: AmountSchema.optional(),
  /** Total paid for this line, only when the memo states it. */
  priceKrw: KrwSchema.optional(),
  /** Price per unit (per cc, per shot) when the memo states it or it follows from priceKrw / amount. */
  unitPriceKrw: KrwSchema.optional(),
  clinicName: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).optional(),
});

export const NotepadPassSchema = z.strictObject({
  clinicName: z.string().trim().min(1),
  /** As written, e.g. "50+5권". */
  description: z.string().trim().min(1),
  /** prepaid_credit: pay 50, get 55 to spend. session_pack: N sessions of one procedure. */
  kind: z.enum(["prepaid_credit", "session_pack"]),
  purchasedOn: IsoDateSchema.optional(),
  paidKrw: KrwSchema.optional(),
  creditKrw: KrwSchema.optional(),
  remainingKrw: KrwSchema.optional(),
  procedureId: ProcedureIdOrUnknownSchema.optional(),
  sessionsTotal: z.number().int().positive().optional(),
  sessionsUsed: z.number().int().nonnegative().optional(),
});

export const NotepadAppointmentSchema = z.strictObject({
  date: IsoDateSchema,
  yearInferred: z.boolean(),
  startTime: TimeSchema.optional(),
  endTime: TimeSchema.optional(),
  clinicName: z.string().trim().min(1).optional(),
  /** Planned procedures as written. */
  plannedText: z.string().trim().min(1).optional(),
});

export const NotepadObservationSchema = z.strictObject({
  /** Verbatim, e.g. "오른쪽 팔자 두드러져 보임". Recorded for the next consultation, never interpreted. */
  text: z.string().trim().min(1),
  bodyPart: BodyPartSchema.optional(),
  side: z.enum(["left", "right", "both"]).optional(),
  date: IsoDateSchema.optional(),
});

export const NotepadQuestionSchema = z.strictObject({
  kind: z.enum(["year_inference", "price_unclear", "pass_balance", "unknown_procedure", "other"]),
  /** In the customer's language. */
  text: z.string().trim().min(1),
});

export const NotepadImportSchema = z.strictObject({
  records: z.array(NotepadRecordSchema),
  passes: z.array(NotepadPassSchema),
  appointments: z.array(NotepadAppointmentSchema),
  observations: z.array(NotepadObservationSchema),
  questions: z.array(NotepadQuestionSchema),
});

export type NotepadRecord = z.infer<typeof NotepadRecordSchema>;
export type NotepadImport = z.infer<typeof NotepadImportSchema>;
