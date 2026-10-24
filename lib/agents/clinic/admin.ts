import { z } from "zod";
import {
  AmountSchema,
  IsoDateSchema,
  KrwSchema,
  LocaleSchema,
  ZkClauseSchema,
} from "../../a2a/schemas";
import type { ClinicProfile, MenuItem, Offer, SlotPolicy } from "../../domain";
import { getProcedure } from "../../domain/procedure-master";
import { newId } from "./sdk";
import {
  getProfile,
  listBookings,
  listMenu,
  putMenuItem,
  putOffer,
  putProfile,
  putSlotPolicy,
  removeMenuItem,
  type ClinicBookingRecord,
} from "./store";

// Clinic data entry (02 "메뉴·가격·이벤트", "예약 가능 시간"): what the clinic console (direct clinics) and the
// operator (proxy clinics) write. Each operation is a pure `normalize*` that validates and builds the entity, and
// an adapter that stores it. The app/api/clinic/** routes (WP7) call the adapters and answer 400 with `issues`.

export type AdminResult<T> = { ok: true; value: T } | { ok: false; issues: string[] };

const issuesOf = (error: z.ZodError): string[] =>
  error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);

const ProcedureIdSchema = z.string().refine((id) => getProcedure(id) !== undefined, "unknown procedure");

// ---- menu ----

export const MenuItemInputSchema = z.strictObject({
  /** Omit to create an item. */
  id: z.string().min(1).optional(),
  procedureId: ProcedureIdSchema,
  product: z.string().min(1),
  amount: AmountSchema,
  priceKrw: KrwSchema,
  vatIncluded: z.boolean(),
  includes: z.array(z.string().min(1)).default([]),
  foreignerSamePrice: z.boolean().default(true),
});
export type MenuItemInput = z.input<typeof MenuItemInputSchema>;

export function normalizeMenu(clinicId: string, items: readonly unknown[]): AdminResult<MenuItem[]> {
  const parsed = z.array(MenuItemInputSchema).safeParse(items);
  if (!parsed.success) return { ok: false, issues: issuesOf(parsed.error) };
  return {
    ok: true,
    value: parsed.data.map(({ id, ...item }) => ({ id: id ?? newId("mnu"), clinicId, ...item })),
  };
}

/** Replaces the clinic's whole regular menu. */
export async function updateMenu(clinicId: string, items: readonly unknown[]): Promise<AdminResult<MenuItem[]>> {
  const result = normalizeMenu(clinicId, items);
  if (!result.ok) return result;
  const keep = new Set(result.value.map((item) => item.id));
  for (const old of await listMenu(clinicId)) if (!keep.has(old.id)) await removeMenuItem(old.id);
  for (const item of result.value) await putMenuItem(item);
  return result;
}

// ---- offers ----

/** All five promotion fields are required (Medical Act enforcement decree art. 23, 08). */
export const OfferInputSchema = z
  .strictObject({
    id: z.string().regex(/^ofr_[A-Za-z0-9_]+$/).optional(),
    procedureId: ProcedureIdSchema,
    title: z.string().min(1),
    amount: AmountSchema,
    priceKrw: KrwSchema,
    regularPriceKrw: KrwSchema,
    validFrom: IsoDateSchema,
    validUntil: IsoDateSchema,
    conditions: z.string().min(1),
    zkClauses: z.array(ZkClauseSchema).min(1).optional(),
  })
  .refine((o) => o.validFrom <= o.validUntil, { message: "validFrom must not be after validUntil", path: ["validUntil"] })
  .refine((o) => o.priceKrw <= o.regularPriceKrw, { message: "event price above the regular price", path: ["priceKrw"] });
export type OfferInput = z.input<typeof OfferInputSchema>;

export function normalizeOffer(clinicId: string, input: unknown): AdminResult<Offer> {
  const parsed = OfferInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: issuesOf(parsed.error) };
  const { id, zkClauses, ...offer } = parsed.data;
  return { ok: true, value: { id: id ?? newId("ofr"), clinicId, ...offer, ...(zkClauses ? { zkClauses } : {}) } };
}

/** Creates or replaces one event. */
export async function upsertOffer(clinicId: string, input: unknown): Promise<AdminResult<Offer>> {
  const result = normalizeOffer(clinicId, input);
  if (result.ok) await putOffer(result.value);
  return result;
}

// ---- slot policy ----

const HoursSchema = z
  .strictObject({ open: z.string().regex(/^\d{2}:\d{2}$/), close: z.string().regex(/^\d{2}:\d{2}$/) })
  .refine((h) => h.open < h.close, "open must be before close")
  .nullable();

export const SlotPolicyInputSchema = z.strictObject({
  durationMinByProcedure: z.record(ProcedureIdSchema, z.number().int().positive()),
  foreignSlotsPerDay: z.number().int().nonnegative(),
  autoConfirm: z.boolean(),
  hours: z.strictObject({
    mon: HoursSchema,
    tue: HoursSchema,
    wed: HoursSchema,
    thu: HoursSchema,
    fri: HoursSchema,
    sat: HoursSchema,
    sun: HoursSchema,
  }),
});

export function normalizeSlotPolicy(clinicId: string, input: unknown): AdminResult<SlotPolicy> {
  const parsed = SlotPolicyInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, issues: issuesOf(parsed.error) };
  return { ok: true, value: { clinicId, ...parsed.data } };
}

export async function setSlotPolicy(clinicId: string, input: unknown): Promise<AdminResult<SlotPolicy>> {
  const result = normalizeSlotPolicy(clinicId, input);
  if (result.ok) await putSlotPolicy(result.value);
  return result;
}

// ---- profile ----

export const ProfilePatchSchema = z.strictObject({
  address: z.string().min(1).optional(),
  doctors: z
    .array(
      z.strictObject({
        name: z.string().min(1),
        boardCertifiedDermatology: z.boolean(),
        yearsOfPractice: z.number().int().nonnegative().optional(),
      }),
    )
    .min(1)
    .optional(),
  contactPerson: z.strictObject({ name: z.string().min(1), role: z.string().min(1) }).optional(),
  languages: z
    .array(z.strictObject({ locale: LocaleSchema, mode: z.enum(["staff", "interpreter", "app_translation"]) }))
    .min(1)
    .optional(),
});

export function applyProfilePatch(profile: ClinicProfile, patch: unknown): AdminResult<ClinicProfile> {
  const parsed = ProfilePatchSchema.safeParse(patch);
  if (!parsed.success) return { ok: false, issues: issuesOf(parsed.error) };
  return { ok: true, value: { ...profile, ...parsed.data } };
}

/**
 * Edits the clinic's profile. Slug, area, operation mode and registration numbers are not editable here: the
 * platform registry mirrors them (BUILD-LOG 20 (2)) and changing them is an onboarding or takeover step.
 */
export async function updateProfile(clinicId: string, patch: unknown): Promise<AdminResult<ClinicProfile>> {
  const profile = await getProfile(clinicId);
  if (!profile) return { ok: false, issues: [`no clinic ${clinicId}`] };
  const result = applyProfilePatch(profile, patch);
  if (result.ok) await putProfile(result.value);
  return result;
}

// ---- inbox ----

/** The clinic's booking requests, newest first (/clinic/inbox). */
export async function listInbox(
  clinicId: string,
  filter: { status?: ClinicBookingRecord["status"] } = {},
): Promise<ClinicBookingRecord[]> {
  const bookings = await listBookings({ clinicId, ...(filter.status === undefined ? {} : { status: filter.status }) });
  return bookings.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
