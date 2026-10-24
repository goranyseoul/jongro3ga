import { z } from "zod";
import { AmountSchema, AreaSchema, IsoDateSchema, IsoDateTimeSchema, LocaleSchema } from "@/lib/a2a/schemas";

// Request bodies of the customer BFF.

export const ConditionSchema = z.object({
  procedureId: z.string().min(1),
  amount: AmountSchema.optional(),
  budgetKrw: z.number().int().nonnegative().optional(),
  areas: z.array(AreaSchema).optional(),
  languages: z.array(LocaleSchema).optional(),
  dateWindow: z.object({ from: IsoDateSchema, to: IsoDateSchema }).optional(),
  productPreference: z.string().min(1).optional(),
});

export const CreateRequestSchema = z.object({
  condition: ConditionSchema,
  rawUtterance: z.string().max(2000).default(""),
  /** true: run match -> quotes -> judge right away. false: draft only (recipe when the amount is missing). */
  start: z.boolean().default(false),
});

export const StartRequestSchema = z.object({ condition: ConditionSchema.partial().optional() });

export const BookSchema = z.object({ quoteId: z.string().min(1), slot: IsoDateTimeSchema });

export const InputValuesSchema = z.object({ values: z.record(z.string(), z.string()) });

export const OutcomeFormSchema = z.object({
  paidKrw: z.number().int().nonnegative(),
  receivedAmount: AmountSchema,
  productVerified: z.enum(["vial_shown", "packaging_shown", "explained_verbally", "not_checked"]),
  satisfaction: z.number().int().min(1).max(5),
  painScore: z.number().int().min(0).max(10),
  wouldReturn: z.boolean(),
  comment: z.string().max(280).optional(),
  sideEffects: z.array(z.string().min(1)).optional(),
});

export const CheckinAnswerSchema = z.object({
  satisfaction: z.number().int().min(1).max(5),
  downtimeDaysActual: z.number().int().min(0).max(60).nullable(),
  wouldReturn: z.boolean(),
  sideEffects: z.array(z.string().min(1)).optional(),
  comment: z.string().max(280).optional(),
});

export const RecordInputSchema = z.object({
  procedureId: z.string().min(1),
  date: IsoDateSchema,
  amount: AmountSchema.optional(),
  priceKrw: z.number().int().nonnegative().optional(),
  clinicId: z.string().min(1).optional(),
  clinicName: z.string().min(1).max(120).optional(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  note: z.string().max(280).optional(),
});

export const RecordPatchSchema = z.object({
  status: z.enum(["active", "paused", "stopped"]).optional(),
  stopReason: z.enum(["no_effect", "expensive", "side_effect", "other"]).optional(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  note: z.string().max(280).optional(),
  date: IsoDateSchema.optional(),
  amount: AmountSchema.optional(),
  priceKrw: z.number().int().nonnegative().optional(),
});

export const ConsentPatchSchema = z.object({
  type: z.enum(["sensitiveHealth", "crossBorder", "shareAnonymizedRecords", "shareWithClinic"]),
  granted: z.boolean(),
});
