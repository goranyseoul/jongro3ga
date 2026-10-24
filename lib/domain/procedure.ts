import { z } from "zod";
import { I18nTextSchema, UnitSchema } from "../a2a/schemas";

// Procedure master (PLANNING.md appendix A, uploaded 2026-10-24). It replaces the earlier 06-data-model.md
// `Procedure` interface: that one had six product level ids, this one has 27 procedures.
//
// The table gives ranges and phrases. Rules used to turn them into numbers, applied by the data, not by code:
//  - cycle days: "한 달" and "매달" are 30 days, "N주" is 7N, "연 1회" is 300~400 (same as 06), "약 1년" is 365.
//  - a range of intervals keeps its lowest value (the earliest recommended date), a range of counts keeps its highest.
//  - downtime "수일" has no number in the table and is read as 2~5 days.
//  - pain written as a range ("중~높음") keeps its upper end, so a pain limit never lets a painful treatment through.
//  - body parts are filled only where the table or scenarios state them. An empty list means "not specified".
//  - anything the table marks [확인] stays null. The original cells are kept in `source`.

export const ProcedureAreaSchema = z.enum([
  "lifting",
  "texture_renewal",
  "volume",
  "wrinkles",
  "contouring",
  "pigment_tone",
  "pores_oil",
  "acne_scars",
  "redness",
  "hydration_glow",
]);

export const BodyPartSchema = z.enum([
  "full_face",
  "forehead",
  "glabella",
  "eyes",
  "under_eye",
  "cheeks",
  "nasolabial",
  "mouth",
  "jawline",
  "square_jaw",
  "lips",
  "neck",
]);

export const ProcedureMethodSchema = z.enum([
  "injection",
  "laser",
  "rf",
  "hifu",
  "rf_microneedle",
  "thread",
  "peel_care",
]);

export const PainSchema = z.enum(["low", "mid", "high"]);
export const EffectOnsetSchema = z.enum(["instant", "1w", "2-4w", "gradual"]);

const DaysRangeSchema = z
  .strictObject({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() })
  .refine((range) => range.min <= range.max, "min must not exceed max");

export const ProcedureSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z][a-z0-9_]*$/),
    name: I18nTextSchema,
    areas: z.array(ProcedureAreaSchema).min(1),
    bodyParts: z.array(BodyPartSchema),
    recommendedParts: z.array(BodyPartSchema),
    avoidParts: z.array(z.strictObject({ part: BodyPartSchema, reason: z.string().min(1) })),
    methods: z.array(ProcedureMethodSchema).min(1),
    unit: UnitSchema.nullable(),
    effectOnset: EffectOnsetSchema.nullable(),
    downtimeDays: DaysRangeSchema.nullable(),
    downtimeNote: z.string().min(1).optional(),
    pain: PainSchema.nullable(),
    cycle: z.strictObject({
      /** A series at the start. `count` is null when the table says "여러 회". */
      initial: z
        .strictObject({ count: z.number().int().positive().nullable(), intervalDays: z.number().int().positive() })
        .optional(),
      /** Null when the table gives no upkeep interval (series only treatments). */
      maintenanceIntervalDays: DaysRangeSchema.nullable(),
    }),
    priceKrw: z
      .strictObject({
        min: z.number().int().nonnegative(),
        max: z.number().int().nonnegative(),
        basis: z.string().min(1).nullable(),
      })
      .refine((price) => price.min <= price.max, "min must not exceed max")
      .nullable(),
    /** founder: the planner's own experience (marked with a star in the table), general: reference value. */
    cycleSource: z.enum(["founder", "general"]),
    /** True only after medical review. */
    verified: z.boolean(),
    /** The original table cells, verbatim. */
    source: z.strictObject({
      area: z.string(),
      method: z.string(),
      unit: z.string(),
      onset: z.string(),
      duration: z.string(),
      downtime: z.string(),
      pain: z.string(),
      cycle: z.string(),
      price: z.string(),
    }),
  })
  .superRefine((procedure, ctx) => {
    for (const part of procedure.recommendedParts) {
      if (!procedure.bodyParts.includes(part)) {
        ctx.addIssue({ code: "custom", path: ["recommendedParts"], message: `${part} is recommended but not a treated part` });
      }
    }
    for (const { part } of procedure.avoidParts) {
      if (procedure.bodyParts.includes(part)) {
        ctx.addIssue({ code: "custom", path: ["avoidParts"], message: `${part} is both treated and avoided` });
      }
    }
  });

export type ProcedureArea = z.infer<typeof ProcedureAreaSchema>;
export type BodyPart = z.infer<typeof BodyPartSchema>;
export type ProcedureMethod = z.infer<typeof ProcedureMethodSchema>;
export type Pain = z.infer<typeof PainSchema>;
export type EffectOnset = z.infer<typeof EffectOnsetSchema>;
export type Procedure = z.infer<typeof ProcedureSchema>;
