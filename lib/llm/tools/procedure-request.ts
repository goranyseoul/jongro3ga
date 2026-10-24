import { z } from "zod";
import {
  AgeBandSchema,
  AmountSchema,
  AreaSchema,
  IsoDateSchema,
  KrwSchema,
  LocaleSchema,
  NationalitySchema,
  ProcedureRequestV1Schema,
  type ProcedureRequestV1,
} from "../../a2a/schemas";
import { ProcedureIdOrUnknownSchema, UNKNOWN_PROCEDURE } from "./common";

// draft_procedure_request (09 LLM table, 02 1절 "요청 정리"). Claude fills everything it can from the
// utterance and the profile defaults; the caller adds requestId and customerAgentId and the result must pass
// ProcedureRequestV1Schema before it goes anywhere. What the customer did not say and no default covers is
// left out, and `followUpQuestion` asks for it ("빠진 필수 슬롯만 되묻는다").

export const DraftProcedureRequestSchema = z.strictObject({
  procedureId: ProcedureIdOrUnknownSchema,
  productPreference: z.string().trim().min(1).optional(),
  /** Missing only when the procedure is unknown or no recipe gave a typical amount. */
  amount: AmountSchema.optional(),
  budgetKrw: z.strictObject({ max: KrwSchema }).optional(),
  /** Location info, not a filter (BUILD-LOG 12): the stay area's whole area group. */
  areas: z.array(AreaSchema).optional(),
  languages: z.array(LocaleSchema).min(1),
  dateWindow: z
    .strictObject({ from: IsoDateSchema, to: IsoDateSchema })
    .refine((window) => window.from <= window.to, "from must not be after to"),
  visitorProfile: z.strictObject({
    nationality: NationalitySchema,
    residency: z.enum(["short_term_visitor", "resident"]).optional(),
    ageBand: AgeBandSchema.optional(),
    firstKProcedure: z.boolean().optional(),
  }),
  notes: z.string().trim().min(1).optional(),
  /** One question in the customer's language for the first missing slot. */
  followUpQuestion: z.string().trim().min(1).optional(),
});

export type DraftProcedureRequest = z.infer<typeof DraftProcedureRequestSchema>;

export type BuildRequestResult =
  | { ok: true; request: ProcedureRequestV1 }
  | { ok: false; missing: string[]; error: string };

/** Turns a validated draft into `pibu/procedure-request@1`. Fails when a required slot is still open. */
export function buildProcedureRequest(
  draft: DraftProcedureRequest,
  ids: { requestId: string; customerAgentId: string },
): BuildRequestResult {
  const missing: string[] = [];
  if (draft.procedureId === UNKNOWN_PROCEDURE) missing.push("procedureId");
  if (draft.amount === undefined) missing.push("amount");
  if (missing.length > 0) return { ok: false, missing, error: `missing ${missing.join(", ")}` };

  const { followUpQuestion: _question, ...fields } = draft;
  void _question;
  const parsed = ProcedureRequestV1Schema.safeParse({
    schema: "pibu/procedure-request@1",
    requestId: ids.requestId,
    customerAgentId: ids.customerAgentId,
    ...fields,
  });
  if (!parsed.success) {
    return { ok: false, missing: [], error: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") };
  }
  return { ok: true, request: parsed.data };
}
