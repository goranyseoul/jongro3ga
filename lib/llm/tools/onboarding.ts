import { z } from "zod";
import {
  AgeBandSchema,
  AmountSchema,
  AreaSchema,
  ConcernSchema,
  IsoDateSchema,
  KrwSchema,
  LocaleSchema,
  NationalitySchema,
} from "../../a2a/schemas";
import { ProcedureIdOrUnknownSchema, TimeSchema } from "./common";

// Onboarding tools of 04-onboarding-chat.md: update_profile, show_widget, request_consent, finish_onboarding.
// The patch shapes follow the slot tables (customer and clinic). A session's draft is the merge of every
// accepted patch, so the draft has the same shape as the patch.

export type OnboardingKind = "customer" | "clinic";

const text = z.string().trim().min(1);

// ---- customer ----

export const CustomerConsentsPatchSchema = z.strictObject({
  terms: z.boolean().optional(),
  privacy: z.boolean().optional(),
  sensitiveHealth: z.boolean().optional(),
  crossBorder: z.boolean().optional(),
  shareAnonymizedRecords: z.boolean().optional(),
});

export const HistoryItemSchema = z.strictObject({
  procedureId: ProcedureIdOrUnknownSchema,
  /** "YYYY-MM" or "YYYY-MM-DD": people remember the month more often than the day. */
  approxDate: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$/, "expected YYYY-MM or YYYY-MM-DD"),
  clinicName: text.optional(),
  amount: AmountSchema.optional(),
  priceKrw: KrwSchema.optional(),
  satisfaction: z.number().int().min(1).max(5).optional(),
});

export const CustomerProfilePatchSchema = z.strictObject({
  locale: LocaleSchema.optional(),
  consents: CustomerConsentsPatchSchema.optional(),
  nickname: text.max(40).optional(),
  nationality: NationalitySchema.optional(),
  residency: z.enum(["short_term_visitor", "resident"]).optional(),
  ageBand: AgeBandSchema.optional(),
  trip: z
    .strictObject({
      arrival: IsoDateSchema.optional(),
      departure: IsoDateSchema.optional(),
      stayArea: AreaSchema.optional(),
      flightTimeHome: TimeSchema.optional(),
    })
    .refine((trip) => !trip.arrival || !trip.departure || trip.arrival <= trip.departure, "arrival must not be after departure")
    .optional(),
  skin: z
    .strictObject({
      type: z.enum(["dry", "oily", "combination", "sensitive", "unknown"]).optional(),
      concerns: z.array(ConcernSchema).min(1).optional(),
    })
    .optional(),
  safety: z
    .strictObject({
      pregnantOrBreastfeeding: z.boolean().optional(),
      allergies: z.array(text).optional(),
      anticoagulants: z.boolean().optional(),
      recentIsotretinoin: z.boolean().optional(),
      keloidHistory: z.boolean().optional(),
    })
    .optional(),
  prefs: z
    .strictObject({
      budgetKrw: z.strictObject({ max: KrwSchema }).optional(),
      downtimeToleranceDays: z.union([z.literal(0), z.literal(1), z.literal(3), z.literal(7)]).optional(),
      painTolerance: z.enum(["low", "mid", "high"]).optional(),
      languagesNeeded: z.array(LocaleSchema).min(1).optional(),
      doctorGender: z.enum(["any", "female"]).optional(),
    })
    .optional(),
  contact: z
    .strictObject({
      channel: z.enum(["email", "line", "wechat", "whatsapp"]).optional(),
      handle: text.optional(),
    })
    .optional(),
  /** Past procedures. An empty list is a valid answer ("없음"). */
  history: z.array(HistoryItemSchema).optional(),
  firstIntent: text.optional(),
});

export type CustomerProfilePatch = z.infer<typeof CustomerProfilePatchSchema>;
/** Everything collected so far in a customer onboarding session. */
export type CustomerOnboardingDraft = CustomerProfilePatch;

// ---- clinic ----

const DaySchema = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

export const ClinicMenuItemDraftSchema = z.strictObject({
  procedureId: ProcedureIdOrUnknownSchema,
  product: text,
  amount: AmountSchema,
  priceKrw: KrwSchema,
  vatIncluded: z.boolean(),
  includes: z.array(text),
  foreignerSamePrice: z.boolean(),
});

export const ClinicProfilePatchSchema = z.strictObject({
  contactPerson: z.strictObject({ name: text.optional(), role: text.optional() }).optional(),
  clinicName: text.optional(),
  address: text.optional(),
  area: AreaSchema.optional(),
  medicalInstitutionId: text.optional(),
  businessRegistrationNo: text.optional(),
  docs: z
    .strictObject({
      openingCertificate: z.boolean().optional(),
      foreignPatientFacilityRegistration: z
        .strictObject({ uploaded: z.boolean(), registrationNo: text.optional() })
        .optional(),
    })
    .optional(),
  doctors: z
    .array(
      z.strictObject({
        name: text,
        boardCertifiedDermatology: z.boolean(),
        yearsOfPractice: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1)
    .optional(),
  languages: z
    .array(z.strictObject({ locale: LocaleSchema, mode: z.enum(["staff", "interpreter", "app_translation"]) }))
    .min(1)
    .optional(),
  menu: z.array(ClinicMenuItemDraftSchema).min(1).optional(),
  hours: z.array(z.strictObject({ day: DaySchema, open: TimeSchema, close: TimeSchema })).min(1).optional(),
  slotPolicy: z
    .strictObject({
      durationMinByProcedure: z.array(
        z.strictObject({ procedureId: ProcedureIdOrUnknownSchema, minutes: z.number().int().positive() }),
      ),
      foreignSlotsPerDay: z.number().int().nonnegative(),
      autoConfirm: z.boolean(),
    })
    .optional(),
  confirmChannel: z.enum(["console", "kakao", "phone"]).optional(),
  commissionAgreement: z.strictObject({ agreed: z.boolean(), version: text }).optional(),
});

export type ClinicProfilePatch = z.infer<typeof ClinicProfilePatchSchema>;
export type ClinicOnboardingDraft = ClinicProfilePatch;

export type OnboardingDraft = CustomerOnboardingDraft | ClinicOnboardingDraft;

export const UpdateCustomerProfileInputSchema = z.strictObject({ patch: CustomerProfilePatchSchema });
export const UpdateClinicProfileInputSchema = z.strictObject({ patch: ClinicProfilePatchSchema });

// ---- slots ----

/** Slot paths a widget can be attached to (04 slot tables). "summary" is the final confirmation card (rule 7). */
export const CUSTOMER_SLOTS = [
  "locale",
  "nickname",
  "nationality",
  "residency",
  "ageBand",
  "trip.arrival",
  "trip.departure",
  "trip",
  "trip.stayArea",
  "trip.flightTimeHome",
  "skin.type",
  "skin.concerns",
  "history",
  "safety.pregnantOrBreastfeeding",
  "safety.allergies",
  "safety.anticoagulants",
  "safety.recentIsotretinoin",
  "safety.keloidHistory",
  "prefs.budgetKrw",
  "prefs.downtimeToleranceDays",
  "prefs.painTolerance",
  "prefs.languagesNeeded",
  "prefs.doctorGender",
  "contact.channel",
  "contact.handle",
  "firstIntent",
  "summary",
] as const;

export const CLINIC_SLOTS = [
  "contactPerson.name",
  "contactPerson.role",
  "clinicName",
  "address",
  "area",
  "medicalInstitutionId",
  "businessRegistrationNo",
  "docs.openingCertificate",
  "docs.foreignPatientFacilityRegistration",
  "doctors",
  "languages",
  "menu",
  "offers",
  "hours",
  "slotPolicy",
  "confirmChannel",
  "commissionAgreement",
  "summary",
] as const;

export const WIDGET_TYPES = [
  "chips",
  "multi_chips",
  "date_range",
  "time",
  "slider",
  "money",
  "yes_no",
  "upload",
  "weekly_hours",
  "summary",
] as const;

export const ShowWidgetInputSchema = z.strictObject({
  type: z.enum(WIDGET_TYPES),
  slot: text,
  options: z.array(z.strictObject({ value: text, label: text })).optional(),
});

export const CUSTOMER_CONSENTS = ["terms", "privacy", "sensitiveHealth", "crossBorder", "shareAnonymizedRecords"] as const;
export const CLINIC_CONSENTS = ["commissionAgreement"] as const;

export const RequestConsentInputSchema = z.strictObject({
  consentType: z.enum([...CUSTOMER_CONSENTS, ...CLINIC_CONSENTS]),
});

export const FinishOnboardingInputSchema = z.strictObject({});

// ---- merging and required slots ----

type Plain = Record<string, unknown>;
const isPlain = (value: unknown): value is Plain => value !== null && typeof value === "object" && !Array.isArray(value);

function merge(base: Plain, patch: Plain): Plain {
  const out: Plain = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    out[key] = isPlain(value) && isPlain(out[key]) ? merge(out[key] as Plain, value) : value;
  }
  return out;
}

/** Objects merge, arrays and scalars replace. Call only with a patch that passed validateToolInput. */
export function applyProfilePatch<T extends OnboardingDraft>(draft: T, patch: T): T {
  return merge(draft as Plain, patch as Plain) as T;
}

export interface SlotStatus {
  slot: string;
  filled: boolean;
}

/**
 * Required (*) slots of the customer table, with the table's own conditions: residency is skipped for KR,
 * the trip for KR and residents, and skin and safety when the sensitive data consent was declined
 * (onboarding then stops at the basic profile, 04 동의 행).
 */
export function customerRequiredSlots(draft: CustomerOnboardingDraft): SlotStatus[] {
  const c = draft.consents ?? {};
  const isKr = draft.nationality === "KR";
  const slots: SlotStatus[] = [
    { slot: "locale", filled: draft.locale !== undefined },
    { slot: "consents.terms", filled: c.terms === true },
    { slot: "consents.privacy", filled: c.privacy === true },
    { slot: "consents.sensitiveHealth", filled: c.sensitiveHealth !== undefined },
    { slot: "consents.crossBorder", filled: c.crossBorder !== undefined },
    { slot: "nickname", filled: draft.nickname !== undefined },
    { slot: "nationality", filled: draft.nationality !== undefined },
  ];
  if (!isKr) slots.push({ slot: "residency", filled: draft.residency !== undefined });
  slots.push({ slot: "ageBand", filled: draft.ageBand !== undefined });
  if (!isKr && draft.residency !== "resident") {
    slots.push({ slot: "trip.arrival", filled: draft.trip?.arrival !== undefined });
    slots.push({ slot: "trip.departure", filled: draft.trip?.departure !== undefined });
  }
  if (c.sensitiveHealth !== false) {
    slots.push({ slot: "skin.concerns", filled: (draft.skin?.concerns?.length ?? 0) > 0 });
    slots.push({ slot: "safety.pregnantOrBreastfeeding", filled: draft.safety?.pregnantOrBreastfeeding !== undefined });
  }
  slots.push({ slot: "prefs.languagesNeeded", filled: (draft.prefs?.languagesNeeded?.length ?? 0) > 0 });
  slots.push({ slot: "contact.channel", filled: draft.contact?.channel !== undefined });
  slots.push({ slot: "contact.handle", filled: draft.contact?.handle !== undefined });
  return slots;
}

export function clinicRequiredSlots(draft: ClinicOnboardingDraft): SlotStatus[] {
  return [
    { slot: "contactPerson.name", filled: draft.contactPerson?.name !== undefined },
    { slot: "contactPerson.role", filled: draft.contactPerson?.role !== undefined },
    { slot: "clinicName", filled: draft.clinicName !== undefined },
    { slot: "address", filled: draft.address !== undefined },
    { slot: "area", filled: draft.area !== undefined },
    { slot: "medicalInstitutionId", filled: draft.medicalInstitutionId !== undefined },
    { slot: "businessRegistrationNo", filled: draft.businessRegistrationNo !== undefined },
    { slot: "docs.openingCertificate", filled: draft.docs?.openingCertificate === true },
    { slot: "docs.foreignPatientFacilityRegistration", filled: draft.docs?.foreignPatientFacilityRegistration !== undefined },
    { slot: "doctors", filled: (draft.doctors?.length ?? 0) > 0 },
    { slot: "languages", filled: (draft.languages?.length ?? 0) > 0 },
    { slot: "menu", filled: (draft.menu?.length ?? 0) > 0 },
    { slot: "hours", filled: (draft.hours?.length ?? 0) > 0 },
    { slot: "slotPolicy", filled: draft.slotPolicy !== undefined },
    { slot: "commissionAgreement", filled: draft.commissionAgreement?.agreed === true },
  ];
}

export function requiredSlots(kind: OnboardingKind, draft: OnboardingDraft): SlotStatus[] {
  return kind === "customer"
    ? customerRequiredSlots(draft as CustomerOnboardingDraft)
    : clinicRequiredSlots(draft as ClinicOnboardingDraft);
}

export function missingRequiredSlots(kind: OnboardingKind, draft: OnboardingDraft): string[] {
  return requiredSlots(kind, draft)
    .filter((status) => !status.filled)
    .map((status) => status.slot);
}

/** "에이전트 완성도": filled required slots over all required slots, 0 to 1. */
export function onboardingProgress(kind: OnboardingKind, draft: OnboardingDraft): number {
  const slots = requiredSlots(kind, draft);
  return slots.filter((status) => status.filled).length / slots.length;
}

/**
 * Rule 3 of 04: skin, past procedures and safety are not collected before the sensitive data consent.
 * A patch may carry the consent and the data together (the consent card answer comes first in the same turn).
 */
export function sensitiveBeforeConsent(draft: CustomerOnboardingDraft, patch: CustomerProfilePatch): boolean {
  const touchesSensitive = patch.skin !== undefined || patch.safety !== undefined || (patch.history?.length ?? 0) > 0;
  if (!touchesSensitive) return false;
  const consent = patch.consents?.sensitiveHealth ?? draft.consents?.sensitiveHealth;
  return consent !== true;
}
