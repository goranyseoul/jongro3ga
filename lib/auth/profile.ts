import { z } from "zod";
import {
  AgeBandSchema,
  AreaSchema,
  ConcernSchema,
  IsoDateSchema,
  IsoDateTimeSchema,
  KrwSchema,
  LocaleSchema,
  NationalitySchema,
} from "../a2a/schemas";
import type { CustomerProfile } from "../domain/customer";
import type { Store } from "../store/types";
import type { SessionUser } from "./session";

// CustomerProfile (06-data-model.md) as the body of PUT /api/me/profile. Strict like the wire schemas:
// a misspelled field is an error, not a silently dropped value. `id` and `agentId` belong to the
// account, so the server fills them; a body that sends different ones is rejected.

const obj = z.strictObject;

export const PROFILE_COLLECTION = "profiles";
export const ACCOUNT_COLLECTION = "accounts";

export const CustomerProfileInputSchema = obj({
  id: z.string().min(1).optional(),
  agentId: z.string().regex(/^cag_[A-Za-z0-9_]+$/).optional(),
  locale: LocaleSchema,
  nickname: z.string().trim().min(1).max(60),
  nationality: NationalitySchema,
  residency: z.enum(["short_term_visitor", "resident"]).optional(),
  ageBand: AgeBandSchema,
  trip: obj({
    arrival: IsoDateSchema,
    departure: IsoDateSchema,
    stayArea: AreaSchema.optional(),
    flightTimeHome: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "expected HH:mm").optional(),
  })
    .refine((trip) => trip.arrival <= trip.departure, { message: "departure must not be before arrival", path: ["departure"] })
    .optional(),
  skin: obj({
    type: z.enum(["dry", "oily", "combination", "sensitive", "unknown"]).optional(),
    concerns: z.array(ConcernSchema),
  }),
  safety: obj({
    pregnantOrBreastfeeding: z.boolean(),
    allergies: z.array(z.string().max(100)).max(30),
    anticoagulants: z.boolean().optional(),
    recentIsotretinoin: z.boolean().optional(),
    keloidHistory: z.boolean().optional(),
  }),
  prefs: obj({
    budgetKrw: obj({ max: KrwSchema }).optional(),
    downtimeToleranceDays: z.number().int().min(0).max(60).optional(),
    painTolerance: z.enum(["low", "mid", "high"]).optional(),
    languagesNeeded: z.array(LocaleSchema),
    doctorGender: z.enum(["any", "female"]).optional(),
  }),
  contact: obj({
    channel: z.enum(["email", "line", "wechat", "whatsapp"]),
    handle: z.string().trim().min(1).max(200),
  }),
  completedAt: IsoDateTimeSchema.optional(),
});

export type CustomerProfileInput = z.infer<typeof CustomerProfileInputSchema>;

export type ProfileParse =
  | { ok: true; profile: CustomerProfile }
  | { ok: false; status: 400 | 403; error: string; issues?: z.core.$ZodIssue[] };

/** Validates a PUT body for `user` and returns the profile to store (id and agentId from the account). */
export function parseProfileBody(body: unknown, user: SessionUser): ProfileParse {
  const parsed = CustomerProfileInputSchema.safeParse(body);
  if (!parsed.success) return { ok: false, status: 400, error: "invalid_profile", issues: parsed.error.issues };
  const input = parsed.data;
  if (input.id !== undefined && input.id !== user.id) return { ok: false, status: 403, error: "profile_id_mismatch" };
  if (input.agentId !== undefined && input.agentId !== user.customerAgentId) return { ok: false, status: 403, error: "agent_id_mismatch" };
  const profile: CustomerProfile = { ...input, id: user.id, agentId: user.customerAgentId };
  return { ok: true, profile };
}

export async function readProfile(store: Store, accountId: string): Promise<CustomerProfile | null> {
  return (await store.get<CustomerProfile>("customer", PROFILE_COLLECTION, accountId)) ?? null;
}

export async function writeProfile(store: Store, profile: CustomerProfile): Promise<void> {
  await store.put("customer", PROFILE_COLLECTION, profile);
}
