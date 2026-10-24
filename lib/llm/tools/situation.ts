import { z } from "zod";
import { LocaleSchema } from "../../a2a/schemas";
import { PainSchema, ProcedureMethodSchema } from "../../domain/procedure";

// "상황을 필터로 변환" (HANDOFF 6, PLANNING.md 8-8): a visitor's own words become the fields of the procedure
// filter's input (lib/agents/platform/procedure-filter.ts ProcedureFilterInput, same names and units), plus
// languages for matching. Only what the words state is set; nothing is guessed from nationality or age.
//   "1년에 한 번밖에 못 와요"  -> minMaintenanceDays 300, visitGapDays 365
//   "여행도 즐기고 싶어요"     -> maxDowntimeDays 0
//   "보수적이에요"            -> excludeMethods ["injection", "thread"]
//   "영어만 돼요"             -> languages ["en"]

export const SITUATION_FIELDS = [
  "minMaintenanceDays",
  "visitGapDays",
  "maxDowntimeDays",
  "excludeMethods",
  "methods",
  "maxPain",
  "budgetKrw",
  "languages",
] as const;

export const SituationFilterSchema = z.strictObject({
  minMaintenanceDays: z.number().int().positive().optional(),
  visitGapDays: z.number().int().positive().optional(),
  maxDowntimeDays: z.number().int().nonnegative().optional(),
  excludeMethods: z.array(ProcedureMethodSchema).optional(),
  methods: z.array(ProcedureMethodSchema).optional(),
  maxPain: PainSchema.optional(),
  budgetKrw: z.number().int().nonnegative().optional(),
  languages: z.array(LocaleSchema).optional(),
  /** Which words set which field, for the "상황 -> 필터 조건" chips. */
  evidence: z.array(
    z.strictObject({
      phrase: z.string().trim().min(1),
      field: z.enum(SITUATION_FIELDS),
    }),
  ),
});

export type SituationFilter = z.infer<typeof SituationFilterSchema>;
