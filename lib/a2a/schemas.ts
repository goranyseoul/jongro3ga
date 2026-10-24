import { z } from "zod";

// Wire schemas for docs/spec/03-a2a-protocol.md ("메시지 스키마") and the skill routing table.
// Every pibu/*@1 object is strict: agents are LLM driven and misspell fields, and a silently
// dropped field would also hide a privacy minimization violation on the clinic side.
const obj = z.strictObject;

/** JSON-RPC "invalid params", used for every validation and routing failure (03 "에러 처리"). */
export const INVALID_PARAMS = -32602;

// ---- shared building blocks ----

const prefixedId = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[A-Za-z0-9_]+$`), `expected an id like ${prefix}_...`);

export const LocaleSchema = z.enum(["ja", "zh-CN", "en", "ko"]);
export const AgeBandSchema = z.enum(["20-24", "25-29", "30-34", "35-39", "40+"]);
export const AreaSchema = z.enum(["gangnam", "sinsa", "apgujeong", "myeongdong", "hongdae", "other"]);
export const UnitSchema = z.enum(["cc", "shot", "unit", "line", "session", "vial"]);
export const ConcernSchema = z.enum([
  "elasticity",
  "fine_lines",
  "pores",
  "acne_scars",
  "pigmentation",
  "redness",
  "dryness",
  "contour",
]);
export const NationalitySchema = z.string().regex(/^[A-Z]{2}$/, "expected an ISO 3166 alpha-2 code");
export const KrwSchema = z.number().int().nonnegative();
export const IsoDateSchema = z.iso.date();
export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export const AmountSchema = obj({ value: z.number().positive(), unit: UnitSchema });
export const I18nTextSchema = z.partialRecord(LocaleSchema, z.string());

const RequestIdSchema = prefixedId("req");
const CustomerAgentIdSchema = prefixedId("cag");
const ClinicIdSchema = prefixedId("cln");
const QuoteIdSchema = prefixedId("qt");
const BookingIdSchema = prefixedId("bkg");
const MatchIdSchema = prefixedId("mt");
const ProcedureIdSchema = z.string().min(1);
const CountSchema = z.number().int().nonnegative();
const RangeSchema = obj({ min: z.number().nonnegative(), max: z.number().nonnegative() });
const TypicalAmountSchema = obj({ min: z.number().positive(), max: z.number().positive(), unit: UnitSchema });

const dateRangeOrdered = (value: { from: string; to: string }) => value.from <= value.to;

/** Promotion terms. Medical Act enforcement decree art. 23 needs all five fields, so none is optional. */
export const EventSchema = obj({
  title: z.string().min(1),
  regularPriceKrw: KrwSchema,
  validFrom: IsoDateSchema,
  validUntil: IsoDateSchema,
  conditions: z.string().min(1),
});

// ---- procedure request ----

export const ProcedureRequestV1Schema = obj({
  schema: z.literal("pibu/procedure-request@1"),
  requestId: RequestIdSchema,
  customerAgentId: CustomerAgentIdSchema,
  procedureId: ProcedureIdSchema,
  productPreference: z.string().min(1).optional(),
  amount: AmountSchema,
  budgetKrw: obj({ max: KrwSchema }).optional(),
  areas: z.array(AreaSchema).optional(),
  languages: z.array(LocaleSchema).min(1),
  dateWindow: obj({ from: IsoDateSchema, to: IsoDateSchema }).refine(dateRangeOrdered, "from must not be after to"),
  visitorProfile: obj({
    nationality: NationalitySchema,
    residency: z.enum(["short_term_visitor", "resident"]).optional(),
    ageBand: AgeBandSchema.optional(),
    firstKProcedure: z.boolean().optional(),
  }),
  notes: z.string().optional(),
});

/** platform.match_clinics: residency and ageBand are required to decide eligibility and matching. */
export const ProcedureRequestForPlatformSchema = ProcedureRequestV1Schema.superRefine((request, ctx) => {
  if (request.visitorProfile.residency === undefined) {
    ctx.addIssue({ code: "custom", path: ["visitorProfile", "residency"], message: "required for platform.match_clinics" });
  }
  if (request.visitorProfile.ageBand === undefined) {
    ctx.addIssue({ code: "custom", path: ["visitorProfile", "ageBand"], message: "required for platform.match_clinics" });
  }
});

/** clinic.quote: the clinic copy carries only the minimal fields, anything else is a data minimization violation. */
export const ProcedureRequestForClinicSchema = ProcedureRequestV1Schema.superRefine((request, ctx) => {
  const forbidden: Array<[string[], unknown]> = [
    [["notes"], request.notes],
    [["budgetKrw"], request.budgetKrw],
    [["visitorProfile", "residency"], request.visitorProfile.residency],
    [["visitorProfile", "ageBand"], request.visitorProfile.ageBand],
  ];
  for (const [path, value] of forbidden) {
    if (value !== undefined) ctx.addIssue({ code: "custom", path, message: "must not be sent to a clinic" });
  }
});

export const ClinicShortlistV1Schema = obj({
  schema: z.literal("pibu/clinic-shortlist@1"),
  requestId: RequestIdSchema,
  matchId: MatchIdSchema,
  appliedRuleIds: z.array(z.string().min(1)),
  priceReference: obj({
    procedureId: ProcedureIdSchema,
    unit: UnitSchema,
    region: z.string().min(1),
    p25UnitKrw: KrwSchema,
    p50UnitKrw: KrwSchema,
    p75UnitKrw: KrwSchema,
    sampleSize: CountSchema,
    windowDays: z.number().int().positive(),
  }),
  candidates: z
    .array(
      obj({
        clinicId: ClinicIdSchema,
        agentCardUrl: z.url(),
        score: z.number().min(0).max(1),
        reasons: z.array(z.string().min(1)),
        referralToken: z.string().min(1),
      }),
    )
    .max(5),
});

// ---- quote, judge ----

export const QuoteV1Schema = obj({
  schema: z.literal("pibu/quote@1"),
  quoteId: QuoteIdSchema,
  requestId: RequestIdSchema,
  clinicId: ClinicIdSchema,
  procedureId: ProcedureIdSchema,
  product: z.string().min(1),
  amount: AmountSchema,
  priceKrw: KrwSchema,
  vatIncluded: z.boolean(),
  includes: z.array(z.string()),
  excludes: z.array(z.string()),
  event: EventSchema.optional(),
  slots: z.array(IsoDateTimeSchema),
  languages: z.array(LocaleSchema),
  indicative: z.boolean(),
  validUntil: IsoDateSchema,
  operationMode: z.enum(["proxy", "clinic"]),
});

export const JudgeRequestV1Schema = obj({
  schema: z.literal("pibu/judge-request@1"),
  requestId: RequestIdSchema,
  matchId: MatchIdSchema,
  quotes: z
    .array(
      obj({
        quoteId: QuoteIdSchema,
        clinicId: ClinicIdSchema,
        procedureId: ProcedureIdSchema,
        amount: AmountSchema,
        priceKrw: KrwSchema,
        vatIncluded: z.boolean(),
        includes: z.array(z.string()),
      }),
    )
    .min(1),
});

// Provisional: the shape follows 03. Revisit when 07 (platform intelligence) is updated.
// Verdict elements carry no `schema` literal in the 03 wire example, only the list does.
export const FairnessVerdictV1Schema = obj({
  quoteId: QuoteIdSchema,
  normalizedUnitKrw: KrwSchema,
  priceBand: z.enum(["low", "mid", "high", "very_high", "insufficient"]),
  doseFlag: z.enum(["below_typical", "within", "above_typical"]),
  typicalAmount: TypicalAmountSchema,
  clinicFlags: z.array(
    obj({ code: z.enum(["paid_more_than_quoted", "indicative_price"]), avgGapPct: z.number().optional() }),
  ),
  label: z.enum(["fair", "good_deal", "high", "very_high", "underdosed", "insufficient_data"]),
  confidence: z.enum(["high", "medium", "low", "none"]),
  sampleSize: CountSchema,
  explanation: I18nTextSchema,
});

export const FairnessVerdictListV1Schema = obj({
  schema: z.literal("pibu/fairness-verdict-list@1"),
  requestId: RequestIdSchema,
  verdicts: z.array(FairnessVerdictV1Schema),
});

// ---- booking ----

export const BookingRequestV1Schema = obj({
  schema: z.literal("pibu/booking-request@1"),
  requestId: RequestIdSchema,
  quoteId: QuoteIdSchema,
  clinicId: ClinicIdSchema,
  slot: IsoDateTimeSchema,
  guest: obj({
    displayName: z.string().min(1),
    contactChannel: z.enum(["email", "line", "wechat", "whatsapp"]),
    contactHandle: z.string().min(1),
    language: LocaleSchema,
  }),
  safetyInfo: obj({
    pregnantOrBreastfeeding: z.boolean(),
    allergies: z.array(z.string()),
    anticoagulants: z.boolean().optional(),
    recentIsotretinoin: z.boolean().optional(),
    keloidHistory: z.boolean().optional(),
  }).optional(),
  consentRef: prefixedId("cns"),
});

export const BookingV1Schema = obj({
  schema: z.literal("pibu/booking@1"),
  bookingId: BookingIdSchema,
  requestId: RequestIdSchema,
  quoteId: QuoteIdSchema,
  clinicId: ClinicIdSchema,
  customerAgentId: CustomerAgentIdSchema,
  slot: IsoDateTimeSchema,
  status: z.enum(["pending_clinic", "confirmed", "canceled", "no_show", "completed"]),
  confirmedBy: z.enum(["clinic_staff", "pibu_operator", "auto"]).optional(),
  priceKrw: KrwSchema,
  referralToken: z.string().min(1),
  instructions: I18nTextSchema.optional(),
});

export const CancelRequestV1Schema = obj({
  schema: z.literal("pibu/cancel-request@1"),
  bookingId: BookingIdSchema,
  reason: z.string().min(1),
});

export const InputRequestV1Schema = obj({
  schema: z.literal("pibu/input-request@1"),
  fields: z
    .array(obj({ key: z.string().min(1), label: I18nTextSchema, sensitive: z.boolean() }))
    .min(1),
});

export const InputResponseV1Schema = obj({
  schema: z.literal("pibu/input-response@1"),
  values: z.record(z.string(), z.string()),
});

// ---- outcome, signal, check-in ----

export const OutcomeV1Schema = obj({
  schema: z.literal("pibu/outcome@1"),
  outcomeId: prefixedId("out"),
  bookingId: BookingIdSchema,
  clinicId: ClinicIdSchema,
  procedureId: ProcedureIdSchema,
  checkpoint: z.enum(["D0", "D7", "D30"]),
  paidKrw: KrwSchema,
  receivedAmount: AmountSchema,
  productVerified: z.string().min(1),
  receiptAttached: z.boolean(),
  satisfaction: z.number().int().min(1).max(5),
  painScore: z.number().int().min(0).max(10),
  downtimeDaysActual: CountSchema.nullable(),
  wouldReturn: z.boolean(),
  sideEffects: z.array(z.string()),
  comment: z.string().optional(),
  visitorProfile: obj({ nationality: NationalitySchema, ageBand: AgeBandSchema }),
  submittedAt: IsoDateTimeSchema,
});

export const SignalReportV1Schema = obj({
  schema: z.literal("pibu/signal-report@1"),
  clinicId: ClinicIdSchema,
  kind: z.enum(["response_timeout", "rejection"]),
  taskId: z.string().min(1).optional(),
  requestId: RequestIdSchema,
  at: IsoDateTimeSchema,
});

export const CheckinRequestV1Schema = obj({
  schema: z.literal("pibu/checkin-request@1"),
  bookingId: BookingIdSchema,
  checkpoint: z.enum(["D7", "D30"]),
  questions: z.array(z.string().min(1)).min(1),
});

export const NotificationV1Schema = obj({
  schema: z.literal("pibu/notification@1"),
  kind: z.enum(["booking_confirmed", "booking_changed", "reminder", "notice"]),
  bookingId: BookingIdSchema.optional(),
  text: I18nTextSchema.refine((text) => Object.keys(text).length > 0, "at least one language is required"),
});

// ---- recipe, offers, availability ----

export const RecipeQueryV1Schema = obj({
  schema: z.literal("pibu/recipe-query@1"),
  concerns: z.array(ConcernSchema).min(1),
  ageBand: AgeBandSchema,
  procedureIds: z.array(ProcedureIdSchema).optional(),
});

export const RecipeV1Schema = obj({
  schema: z.literal("pibu/recipe@1"),
  combinations: z.array(
    obj({ procedureIds: z.array(ProcedureIdSchema).min(1), share: z.number().min(0).max(1), sampleSize: CountSchema }),
  ),
  procedures: z.array(
    obj({
      procedureId: ProcedureIdSchema,
      typicalAmount: TypicalAmountSchema,
      cycle: obj({
        initial: obj({ count: z.number().int().positive(), intervalDays: z.number().int().positive() }).optional(),
        maintenanceIntervalDays: RangeSchema,
      }),
      downtimeDays: RangeSchema,
      onsetDays: RangeSchema,
    }),
  ),
  disclaimer: z.string().min(1),
});

export const OffersQueryV1Schema = obj({
  schema: z.literal("pibu/offers-query@1"),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "expected YYYY-MM").optional(),
});

export const OffersV1Schema = obj({
  schema: z.literal("pibu/offers@1"),
  clinicId: ClinicIdSchema,
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "expected YYYY-MM"),
  items: z.array(
    obj({
      procedureId: ProcedureIdSchema,
      product: z.string().min(1),
      amount: AmountSchema,
      priceKrw: KrwSchema,
      vatIncluded: z.boolean(),
      event: EventSchema.optional(),
    }),
  ),
});

export const AvailabilityQueryV1Schema = obj({
  schema: z.literal("pibu/availability-query@1"),
  procedureId: ProcedureIdSchema,
  from: IsoDateSchema,
  to: IsoDateSchema,
}).refine(dateRangeOrdered, "from must not be after to");

export const AvailabilityV1Schema = obj({
  schema: z.literal("pibu/availability@1"),
  clinicId: ClinicIdSchema,
  slots: z.array(IsoDateTimeSchema),
  indicative: z.boolean(),
});

// ---- inferred types ----

export type ProcedureRequestV1 = z.infer<typeof ProcedureRequestV1Schema>;
export type ClinicShortlistV1 = z.infer<typeof ClinicShortlistV1Schema>;
export type QuoteV1 = z.infer<typeof QuoteV1Schema>;
export type JudgeRequestV1 = z.infer<typeof JudgeRequestV1Schema>;
export type FairnessVerdictV1 = z.infer<typeof FairnessVerdictV1Schema>;
export type FairnessVerdictListV1 = z.infer<typeof FairnessVerdictListV1Schema>;
export type BookingRequestV1 = z.infer<typeof BookingRequestV1Schema>;
export type BookingV1 = z.infer<typeof BookingV1Schema>;
export type CancelRequestV1 = z.infer<typeof CancelRequestV1Schema>;
export type InputRequestV1 = z.infer<typeof InputRequestV1Schema>;
export type InputResponseV1 = z.infer<typeof InputResponseV1Schema>;
export type OutcomeV1 = z.infer<typeof OutcomeV1Schema>;
export type SignalReportV1 = z.infer<typeof SignalReportV1Schema>;
export type CheckinRequestV1 = z.infer<typeof CheckinRequestV1Schema>;
export type NotificationV1 = z.infer<typeof NotificationV1Schema>;
export type RecipeQueryV1 = z.infer<typeof RecipeQueryV1Schema>;
export type RecipeV1 = z.infer<typeof RecipeV1Schema>;
export type OffersQueryV1 = z.infer<typeof OffersQueryV1Schema>;
export type OffersV1 = z.infer<typeof OffersV1Schema>;
export type AvailabilityQueryV1 = z.infer<typeof AvailabilityQueryV1Schema>;
export type AvailabilityV1 = z.infer<typeof AvailabilityV1Schema>;

/** Every wire schema by its `data.schema` name, for validating outputs and logged payloads. */
export const PIBU_SCHEMAS = {
  "pibu/procedure-request@1": ProcedureRequestV1Schema,
  "pibu/clinic-shortlist@1": ClinicShortlistV1Schema,
  "pibu/quote@1": QuoteV1Schema,
  "pibu/judge-request@1": JudgeRequestV1Schema,
  "pibu/fairness-verdict-list@1": FairnessVerdictListV1Schema,
  "pibu/booking-request@1": BookingRequestV1Schema,
  "pibu/booking@1": BookingV1Schema,
  "pibu/cancel-request@1": CancelRequestV1Schema,
  "pibu/input-request@1": InputRequestV1Schema,
  "pibu/input-response@1": InputResponseV1Schema,
  "pibu/outcome@1": OutcomeV1Schema,
  "pibu/signal-report@1": SignalReportV1Schema,
  "pibu/checkin-request@1": CheckinRequestV1Schema,
  "pibu/notification@1": NotificationV1Schema,
  "pibu/recipe-query@1": RecipeQueryV1Schema,
  "pibu/recipe@1": RecipeV1Schema,
  "pibu/offers-query@1": OffersQueryV1Schema,
  "pibu/offers@1": OffersV1Schema,
  "pibu/availability-query@1": AvailabilityQueryV1Schema,
  "pibu/availability@1": AvailabilityV1Schema,
} as const;

export type PibuSchemaName = keyof typeof PIBU_SCHEMAS;

// ---- skill routing (03 "스킬 라우팅 규칙") ----

/** Input schema per skill, plus the output schema name for executors ("text" means a text Part only). */
export const SKILL_ROUTES = {
  "platform.recipe": { input: "pibu/recipe-query@1", output: "pibu/recipe@1", schema: RecipeQueryV1Schema },
  "platform.match_clinics": {
    input: "pibu/procedure-request@1",
    output: "pibu/clinic-shortlist@1",
    schema: ProcedureRequestForPlatformSchema,
  },
  "platform.judge_quote": {
    input: "pibu/judge-request@1",
    output: "pibu/fairness-verdict-list@1",
    schema: JudgeRequestV1Schema,
  },
  "platform.report_booking": { input: "pibu/booking@1", output: "text", schema: BookingV1Schema },
  "platform.submit_outcome": { input: "pibu/outcome@1", output: "text", schema: OutcomeV1Schema },
  "platform.report_signal": { input: "pibu/signal-report@1", output: "text", schema: SignalReportV1Schema },
  "clinic.offers": { input: "pibu/offers-query@1", output: "pibu/offers@1", schema: OffersQueryV1Schema },
  "clinic.quote": { input: "pibu/procedure-request@1", output: "pibu/quote@1", schema: ProcedureRequestForClinicSchema },
  "clinic.availability": {
    input: "pibu/availability-query@1",
    output: "pibu/availability@1",
    schema: AvailabilityQueryV1Schema,
  },
  "clinic.book": { input: "pibu/booking-request@1", output: "pibu/booking@1", schema: BookingRequestV1Schema },
  "clinic.cancel": { input: "pibu/cancel-request@1", output: "pibu/booking@1", schema: CancelRequestV1Schema },
  "customer.notify": { input: "pibu/notification@1", output: "text", schema: NotificationV1Schema },
  "customer.checkin": { input: "pibu/checkin-request@1", output: "pibu/outcome@1", schema: CheckinRequestV1Schema },
} as const;

export type SkillId = keyof typeof SKILL_ROUTES;
export type SkillInput<K extends SkillId> = z.infer<(typeof SKILL_ROUTES)[K]["schema"]>;

export const SKILL_IDS = Object.keys(SKILL_ROUTES) as SkillId[];

export function isSkillId(value: unknown): value is SkillId {
  return typeof value === "string" && Object.hasOwn(SKILL_ROUTES, value);
}

const INPUT_RESPONSE = "pibu/input-response@1";
const INPUT_REQUIRED = "TASK_STATE_INPUT_REQUIRED";

export interface PibuParseError {
  code: typeof INVALID_PARAMS;
  message: string;
  /** zod issue paths for the JSON-RPC error `data`. */
  data: { issues: Array<{ path: string; code: string; message: string }> };
}

export type PibuParseResult =
  | { [K in SkillId]: { ok: true; kind: "input"; skillId: K; data: SkillInput<K> } }[SkillId]
  | { ok: true; kind: "input_response"; skillId: SkillId; data: InputResponseV1 }
  | { ok: false; error: PibuParseError };

const fail = (message: string, issues: PibuParseError["data"]["issues"] = []): PibuParseResult => ({
  ok: false,
  error: { code: INVALID_PARAMS, message, data: { issues } },
});

/**
 * Validates the first DataPart of a request against the skill it was routed to.
 * `task` is the existing task when the message continues one (taskId present).
 * Failures never throw: callers answer with the JSON-RPC error and create no task.
 */
export function parsePibuData(
  skillId: unknown,
  data: unknown,
  task?: { state: string },
): PibuParseResult {
  if (!isSkillId(skillId)) return fail(`unknown skillId: ${String(skillId)}`);
  if (typeof data !== "object" || data === null || Array.isArray(data)) return fail("data part must be a JSON object");

  const name = (data as { schema?: unknown }).schema;
  if (typeof name !== "string") return fail("data.schema is required");

  const awaitingInput = task?.state === INPUT_REQUIRED;

  if (name === INPUT_RESPONSE) {
    if (!awaitingInput) return fail(`${INPUT_RESPONSE} is only accepted for a task in ${INPUT_REQUIRED}`);
    const parsed = InputResponseV1Schema.safeParse(data);
    return parsed.success
      ? { ok: true, kind: "input_response", skillId, data: parsed.data }
      : fail(`invalid ${INPUT_RESPONSE}`, issuesOf(parsed.error));
  }

  if (awaitingInput) return fail(`task is waiting for ${INPUT_RESPONSE}, got ${name}`);

  const route = SKILL_ROUTES[skillId];
  if (name !== route.input) return fail(`skill ${skillId} expects ${route.input}, got ${name}`);

  const parsed = route.schema.safeParse(data);
  if (!parsed.success) return fail(`invalid ${route.input} for ${skillId}`, issuesOf(parsed.error));
  return { ok: true, kind: "input", skillId, data: parsed.data } as PibuParseResult;
}

function issuesOf(error: z.ZodError): PibuParseError["data"]["issues"] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join("."),
    code: issue.code,
    message: issue.message,
  }));
}
