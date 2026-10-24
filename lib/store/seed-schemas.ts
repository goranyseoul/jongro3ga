import { z } from "zod";
import {
  AgeBandSchema,
  AmountSchema,
  AreaSchema,
  ConcernSchema,
  I18nTextSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  KrwSchema,
  LocaleSchema,
  NationalitySchema,
  OutcomeV1Schema,
  ZkClauseSchema,
} from "../a2a/schemas";
import type {
  ClinicProfile,
  ClinicRegistryEntry,
  ConsentEntry,
  CustomerAccount,
  CustomerProfile,
  LanguageSupport,
  MenuItem,
  Offer,
  Outcome,
  PriceRecord,
  ReviewStat,
  RoutingRule,
  RuleAction,
  RuleCondition,
  Slot,
  SlotPolicy,
  TreatmentRecord,
  VerifiedVisitStat,
} from "../domain";

// Zod schemas for the seed files in data/seed/ (06-data-model.md "시드 파일"). Each entity schema mirrors its
// lib/domain interface and is checked against it with `satisfies z.ZodType<T>`, so a field added to the domain
// type that the seed schema does not produce fails the typecheck. Objects are strict: a misspelled seed field is
// an error, not a silently dropped value.

const obj = z.strictObject;
const id = z.string().min(1);
const clinicId = z.string().regex(/^cln_[a-z0-9_]+$/);
const procedureId = z.string().regex(/^[a-z][a-z0-9_]*$/);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const LanguageSupportSchema = obj({
  locale: LocaleSchema,
  mode: z.enum(["staff", "interpreter", "app_translation"]),
}) satisfies z.ZodType<LanguageSupport>;

// ---- clinics.json ----

export const ClinicRegistryEntrySchema = obj({
  id: clinicId,
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: I18nTextSchema,
  area: AreaSchema,
  agentCardUrl: z.url(),
  operationMode: z.enum(["proxy", "clinic"]),
  dataSources: z.array(z.enum(["sms", "public_web", "clinic_input"])).min(1),
  lastVerifiedAt: IsoDateSchema,
  foreignPatientFacilityRegistered: z.boolean(),
  verificationStatus: z.enum(["verified", "pending_verification", "suspended"]),
  languages: z.array(LanguageSupportSchema).min(1),
}) satisfies z.ZodType<ClinicRegistryEntry>;

export const ClinicProfileSchema = obj({
  id: clinicId,
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: I18nTextSchema,
  address: z.string().min(1),
  area: AreaSchema,
  medicalInstitutionId: z.string().min(1),
  businessRegistrationNo: z.string().min(1),
  foreignPatientFacilityRegNo: z.string().min(1).optional(),
  doctors: z.array(
    obj({ name: z.string().min(1), boardCertifiedDermatology: z.boolean(), yearsOfPractice: z.number().int().nonnegative().optional() }),
  ),
  languages: z.array(LanguageSupportSchema).min(1),
  operationMode: z.enum(["proxy", "clinic"]),
  contactPerson: obj({ name: z.string().min(1), role: z.string().min(1) }).optional(),
}) satisfies z.ZodType<ClinicProfile>;

export const MenuItemSchema = obj({
  id,
  clinicId,
  procedureId,
  product: z.string().min(1),
  amount: AmountSchema,
  priceKrw: KrwSchema,
  vatIncluded: z.boolean(),
  includes: z.array(z.string().min(1)),
  foreignerSamePrice: z.boolean(),
}) satisfies z.ZodType<MenuItem>;

/** All five promotion fields are required (Medical Act enforcement decree art. 23), zkClauses or not. */
export const OfferSchema = obj({
  id: z.string().regex(/^ofr_[A-Za-z0-9_]+$/),
  clinicId,
  procedureId,
  title: z.string().min(1),
  amount: AmountSchema,
  priceKrw: KrwSchema,
  regularPriceKrw: KrwSchema,
  validFrom: IsoDateSchema,
  validUntil: IsoDateSchema,
  conditions: z.string().min(1),
  zkClauses: z.array(ZkClauseSchema).min(1).optional(),
})
  .refine((offer) => offer.validFrom <= offer.validUntil, "validFrom must not be after validUntil")
  .refine((offer) => offer.priceKrw <= offer.regularPriceKrw, "an event price above the regular price is not an event") satisfies z.ZodType<Offer>;

const OpeningHoursSchema = obj({ open: hhmm, close: hhmm }).nullable();

export const SlotPolicySchema = obj({
  clinicId,
  durationMinByProcedure: z.record(procedureId, z.number().int().positive()),
  foreignSlotsPerDay: z.number().int().nonnegative(),
  autoConfirm: z.boolean(),
  hours: obj({
    mon: OpeningHoursSchema,
    tue: OpeningHoursSchema,
    wed: OpeningHoursSchema,
    thu: OpeningHoursSchema,
    fri: OpeningHoursSchema,
    sat: OpeningHoursSchema,
    sun: OpeningHoursSchema,
  }),
}) satisfies z.ZodType<SlotPolicy>;

export const ClinicsSeedSchema = obj({
  registry: z.array(ClinicRegistryEntrySchema),
  profiles: z.array(ClinicProfileSchema),
  menus: z.array(MenuItemSchema),
  offers: z.array(OfferSchema),
  slotPolicies: z.array(SlotPolicySchema),
});

// ---- slots.json ----

export const SlotSchema = obj({
  id,
  clinicId,
  start: IsoDateTimeSchema,
  procedureIds: z.array(procedureId).min(1),
  held: z.boolean(),
}) satisfies z.ZodType<Slot>;

// ---- price-records.json ----

export const PriceRecordSchema = obj({
  id,
  procedureId,
  product: z.string().min(1).optional(),
  area: AreaSchema,
  amount: AmountSchema,
  paidKrw: KrwSchema,
  normalizedUnitKrw: KrwSchema,
  source: z.enum(["outcome", "shared_record", "public_offer"]),
  verified: z.boolean(),
  ageBand: AgeBandSchema.optional(),
  nationalityGroup: z.enum(["KR", "foreign"]).optional(),
  clinicId: clinicId.optional(),
  date: IsoDateSchema,
}).refine(
  (record) => record.normalizedUnitKrw === Math.round(record.paidKrw / record.amount.value),
  "normalizedUnitKrw must be paidKrw / amount.value",
) satisfies z.ZodType<PriceRecord>;

// ---- outcomes.json, outcomes-ara-burst.json ----

export const OutcomeSchema = OutcomeV1Schema.extend({
  id,
  receivedAt: IsoDateTimeSchema,
  quotedKrw: KrwSchema.optional(),
  quoteGapRatio: z.number().optional(),
}) satisfies z.ZodType<Outcome>;

/** A burst outcome before injection: no timestamps yet, `daysAgo` says how far before `now` it lands. */
export const AraBurstTemplateSchema = OutcomeSchema.omit({ submittedAt: true, receivedAt: true }).extend({
  daysAgo: z.number().int().min(1).max(29),
});
export type AraBurstTemplate = z.infer<typeof AraBurstTemplateSchema>;

// ---- customers.json ----

export const CustomerAccountSchema = obj({
  id: z.string().regex(/^cus_[a-z0-9_]+$/),
  email: z.email().optional(),
  demoPersona: z.string().min(1).optional(),
  agentId: z.string().regex(/^cag_[A-Za-z0-9_]+$/),
  createdAt: IsoDateTimeSchema,
}) satisfies z.ZodType<CustomerAccount>;

export const CustomerProfileSchema = obj({
  id: z.string().regex(/^cus_[a-z0-9_]+$/),
  agentId: z.string().regex(/^cag_[A-Za-z0-9_]+$/),
  locale: LocaleSchema,
  nickname: z.string().min(1),
  nationality: NationalitySchema,
  residency: z.enum(["short_term_visitor", "resident"]).optional(),
  ageBand: AgeBandSchema,
  trip: obj({ arrival: IsoDateSchema, departure: IsoDateSchema, stayArea: AreaSchema.optional(), flightTimeHome: hhmm.optional() }).optional(),
  skin: obj({ type: z.enum(["dry", "oily", "combination", "sensitive", "unknown"]).optional(), concerns: z.array(ConcernSchema) }),
  safety: obj({
    pregnantOrBreastfeeding: z.boolean(),
    allergies: z.array(z.string().min(1)),
    anticoagulants: z.boolean().optional(),
    recentIsotretinoin: z.boolean().optional(),
    keloidHistory: z.boolean().optional(),
  }),
  prefs: obj({
    budgetKrw: obj({ max: KrwSchema }).optional(),
    downtimeToleranceDays: z.number().int().nonnegative().optional(),
    painTolerance: z.enum(["low", "mid", "high"]).optional(),
    languagesNeeded: z.array(LocaleSchema).min(1),
    doctorGender: z.enum(["any", "female"]).optional(),
  }),
  contact: obj({ channel: z.enum(["email", "line", "wechat", "whatsapp"]), handle: z.string().min(1) }),
  completedAt: IsoDateTimeSchema.optional(),
})
  // 06: residency is for foreign nationals only, KR has none
  .refine((profile) => (profile.nationality === "KR") === (profile.residency === undefined), "residency is set exactly for non KR nationals")
  .refine((profile) => !profile.trip || profile.trip.arrival <= profile.trip.departure, "trip arrival after departure") satisfies z.ZodType<CustomerProfile>;

export const ConsentEntrySchema = obj({
  id: z.string().regex(/^cns_[0-9a-z_]+$/),
  customerId: z.string().regex(/^cus_[a-z0-9_]+$/),
  type: z.enum(["terms", "privacy", "sensitiveHealth", "crossBorder", "shareAnonymizedRecords", "shareWithClinic"]),
  granted: z.boolean(),
  scope: z.array(z.string().min(1)),
  recipientRole: z.enum(["platform", "clinic"]).optional(),
  textVersion: z.string().min(1),
  at: IsoDateTimeSchema,
}) satisfies z.ZodType<ConsentEntry>;

export const TreatmentRecordSchema = obj({
  id,
  customerId: z.string().regex(/^cus_[a-z0-9_]+$/),
  procedureId,
  date: IsoDateSchema,
  amount: AmountSchema.optional(),
  priceKrw: KrwSchema.optional(),
  clinicId: clinicId.optional(),
  clinicName: z.string().min(1).optional(),
  source: z.enum(["manual", "booking", "onboarding_history"]),
  receiptImage: z.string().min(1).optional(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
  note: z.string().optional(),
  anchor: obj({ subjectId: z.string(), version: z.number().int().positive(), tx: z.string(), recordHash: z.string() }).optional(),
  sessionNumber: z.number().int().positive(),
  nextDue: IsoDateSchema.optional(),
  status: z.enum(["active", "paused", "stopped"]),
  stopReason: z.enum(["no_effect", "expensive", "side_effect", "other"]).optional(),
  sharedToPlatform: z.boolean(),
}) satisfies z.ZodType<TreatmentRecord>;

export const CustomersSeedSchema = obj({
  accounts: z.array(CustomerAccountSchema),
  profiles: z.array(CustomerProfileSchema),
  consents: z.array(ConsentEntrySchema),
  records: z.array(TreatmentRecordSchema),
});

// ---- rules.json ----

export const RuleConditionSchema = obj({
  procedureIds: z.array(procedureId).optional(),
  nationalities: z.array(NationalitySchema).optional(),
  languages: z.array(LocaleSchema).optional(),
  areas: z.array(AreaSchema).optional(),
  ageBands: z.array(AgeBandSchema).optional(),
  firstKProcedure: z.boolean().optional(),
  budgetMaxBelowKrw: KrwSchema.optional(),
}) satisfies z.ZodType<RuleCondition>;

const delta = z.number().min(0).max(0.3);
export const RuleActionSchema = z.discriminatedUnion("kind", [
  obj({ kind: z.literal("exclude_clinic"), clinicIds: z.array(clinicId).min(1) }),
  obj({ kind: z.literal("boost_clinic"), clinicIds: z.array(clinicId).min(1), delta }),
  obj({ kind: z.literal("demote_clinic"), clinicIds: z.array(clinicId).min(1), delta }),
  obj({ kind: z.literal("prefer_area"), areas: z.array(AreaSchema).min(1), delta }),
  obj({ kind: z.literal("require_language"), languages: z.array(LocaleSchema).min(1) }),
]) satisfies z.ZodType<RuleAction>;

export const RoutingRuleSchema = obj({
  id: z.string().regex(/^rule_[0-9a-z_]+$/),
  version: z.number().int().positive(),
  status: z.enum(["proposed", "active", "rejected", "retired"]),
  when: RuleConditionSchema,
  then: RuleActionSchema,
  reason: z.string().min(1),
  evidence: obj({ outcomeIds: z.array(z.string()), signalIds: z.array(z.string()), summary: z.string() }),
  source: z.enum(["operator", "auto_proposal"]),
  proposedBy: z.string().optional(),
  approvedBy: z.string().optional(),
  createdAt: IsoDateTimeSchema,
  activatedAt: IsoDateTimeSchema.optional(),
  expiresAt: IsoDateTimeSchema.optional(),
  appliedCount: z.number().int().nonnegative(),
}) satisfies z.ZodType<RoutingRule>;

// ---- kr-patterns.json (07 "레시피"; no interface in 06, so the type is defined here) ----

export const KrPatternSchema = obj({
  id: z.string().regex(/^krp_[a-z0-9_]+$/),
  ageBand: AgeBandSchema,
  concerns: z.array(ConcernSchema).min(1),
  /** One procedure or a combination received together. */
  procedureIds: z.array(procedureId).min(1),
  /** Share of the (ageBand, concerns) group choosing this combination, 0..1. */
  share: z.number().min(0).max(1),
  /** Size of the (ageBand, concerns) group. */
  sampleSize: z.number().int().positive(),
  dataStatus: z.literal("demo_assumption"),
});
export type KrPattern = z.infer<typeof KrPatternSchema>;

// ---- fx.json ----

export const FxRateSchema = obj({
  id: z.enum(["JPY", "CNY", "USD"]),
  krwPerUnit: z.number().positive(),
  asOf: IsoDateSchema,
});
export type FxRate = z.infer<typeof FxRateSchema>;

// ---- verified-visits.json (ZK extension) ----

export const VerifiedVisitStatSchema = obj({
  id,
  clinicId,
  procedureId,
  count: z.number().int().nonnegative(),
}) satisfies z.ZodType<VerifiedVisitStat>;

/** Review text published with the aggregate (owner decision 2026-10-24, BUILD-LOG 17). Fictional in the seed. */
export const SeedReviewSchema = obj({
  rating: z.number().int().min(1).max(5),
  text: z.string().min(1).max(300),
  locale: LocaleSchema,
});

/** Anonymity set below this size: no reviewStats at all (07 "검증 방문과 후기 집계", 08). */
export const MIN_ANON_SET = 3;

export const ReviewStatSchema = obj({
  id,
  clinicId,
  procedureId,
  n: z.number().int().min(MIN_ANON_SET),
  avgRating: z.number().min(1).max(5),
  nullifiers: z.array(z.string().min(1)),
  reviews: z.array(SeedReviewSchema),
})
  .refine((stat) => stat.nullifiers.length === stat.n && stat.reviews.length === stat.n, "n must match nullifiers and reviews")
  .refine((stat) => new Set(stat.nullifiers).size === stat.nullifiers.length, "a nullifier is spent once")
  .refine(
    (stat) => Math.round((stat.reviews.reduce((sum, r) => sum + r.rating, 0) / stat.n) * 10) / 10 === stat.avgRating,
    "avgRating must be the mean of the review ratings, one decimal",
  ) satisfies z.ZodType<ReviewStat>;
/** ReviewStat with the review texts it aggregates, stored as is in platform.review_stats. */
export type SeedReviewStat = z.infer<typeof ReviewStatSchema>;

export const VerifiedVisitsSeedSchema = obj({
  verifiedVisits: z.array(VerifiedVisitStatSchema),
  reviewStats: z.array(ReviewStatSchema),
});
