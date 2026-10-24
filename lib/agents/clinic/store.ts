// Clinic namespace access (06-data-model.md "병원 네임스페이스"). Only this module reads or writes
// store namespace "clinic"; other modules reach clinic data through A2A or the console service.
//
// Relative imports on purpose: vitest has no "@/" alias config in this repo, and these files are under test.
import { getStore } from "../../store";
import type { Store } from "../../store/types";
import { clock } from "../../clock";
import type { BookingRequestV1, BookingV1 } from "../../a2a/schemas";
import type { Amount, IsoDate, IsoDateTime, Krw, Locale } from "../../domain/common";
import type { ClinicBooking, ClinicProfile, ClinicTask, MenuItem, Offer, Slot, SlotPolicy } from "../../domain/clinic";

/** Collection names inside namespace "clinic". The seed loader (data/seed/load.ts) writes these. */
export const CLINIC_COLLECTIONS = {
  profiles: "profiles",
  operation: "operation",
  menu: "menu_items",
  offers: "offers",
  slotPolicies: "slot_policies",
  slots: "slots",
  bookings: "bookings",
  tasks: "tasks",
  quotes: "quotes",
} as const;

const NS = "clinic" as const;

/** Data provenance carried by the clinic-operation extension (03-a2a-protocol.md 확장). id = clinic id. */
export interface ClinicOperation {
  id: string;
  mode: "proxy" | "clinic";
  dataSources: ("sms" | "public_web" | "clinic_input")[];
  lastVerifiedAt: IsoDate;
  foreignPatientFacilityRegistered: boolean;
}

/** `active: false` keeps an event but stops sending it to customer agents (console switch). */
export type StoredOffer = Offer & { active?: boolean };

export type StoredSlotPolicy = SlotPolicy & { id: string };

/** What the clinic asked the guest while the booking task sits in INPUT_REQUIRED. */
export interface AwaitingGuest {
  kind: "propose" | "ask";
  fields: { key: string; label: Partial<Record<Locale, string>>; sensitive: boolean }[];
  proposedSlot?: IsoDateTime;
  at: IsoDateTime;
}

export type StoredBooking = ClinicBooking & {
  customerAgentId: string;
  referralToken: string;
  quoteId: string;
  procedureId: string;
  product: string;
  amount: Amount;
  priceKrw: Krw;
  contextId: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  awaitingGuest?: AwaitingGuest;
  guestInput?: Record<string, string>;
  rejectReason?: string;
  confirmedAt?: IsoDateTime;
  /** Result of the A2A calls made on confirmation, for the console and debugging. */
  reports?: Partial<Record<"platform" | "customer", { ok: boolean; state?: string; error?: string; at: IsoDateTime }>>;
};

/** One row per A2A task this clinic agent received (inbox, dashboard counts). id = A2A task id. */
export type StoredTask = ClinicTask & {
  contextId: string;
  state: string;
  customerAgentId?: string;
  language?: Locale;
  procedureId?: string;
  product?: string;
  amount?: Amount;
  priceKrw?: Krw;
  latencyMs?: number;
  quoteId?: string;
  bookingId?: string;
  reason?: string;
};

/** Quotes this clinic issued, so clinic.book can price a booking from its quoteId. */
export interface StoredQuote {
  id: string;
  clinicId: string;
  quote: Record<string, unknown> & {
    quoteId: string;
    requestId: string;
    procedureId: string;
    product: string;
    amount: Amount;
    priceKrw: Krw;
  };
  offerId?: string;
  createdAt: IsoDateTime;
}

export function clinicStore(store: Store = getStore()) {
  return {
    store,
    profile: (id: string) => store.get<ClinicProfile>(NS, CLINIC_COLLECTIONS.profiles, id),
    profiles: () => store.list<ClinicProfile>(NS, CLINIC_COLLECTIONS.profiles),
    putProfile: (value: ClinicProfile) => store.put(NS, CLINIC_COLLECTIONS.profiles, value),
    operation: (id: string) => store.get<ClinicOperation>(NS, CLINIC_COLLECTIONS.operation, id),
    putOperation: (value: ClinicOperation) => store.put(NS, CLINIC_COLLECTIONS.operation, value),
    menu: (clinicId: string) => store.list<MenuItem>(NS, CLINIC_COLLECTIONS.menu, { clinicId }),
    menuItem: (id: string) => store.get<MenuItem>(NS, CLINIC_COLLECTIONS.menu, id),
    putMenuItem: (value: MenuItem) => store.put(NS, CLINIC_COLLECTIONS.menu, value),
    offers: (clinicId: string) => store.list<StoredOffer>(NS, CLINIC_COLLECTIONS.offers, { clinicId }),
    offer: (id: string) => store.get<StoredOffer>(NS, CLINIC_COLLECTIONS.offers, id),
    putOffer: (value: StoredOffer) => store.put(NS, CLINIC_COLLECTIONS.offers, value),
    removeOffer: (id: string) => store.remove(NS, CLINIC_COLLECTIONS.offers, id),
    slotPolicy: (clinicId: string) => store.get<StoredSlotPolicy>(NS, CLINIC_COLLECTIONS.slotPolicies, clinicId),
    putSlotPolicy: (value: StoredSlotPolicy) => store.put(NS, CLINIC_COLLECTIONS.slotPolicies, value),
    slots: (clinicId: string) => store.list<Slot>(NS, CLINIC_COLLECTIONS.slots, { clinicId }),
    putSlot: (value: Slot) => store.put(NS, CLINIC_COLLECTIONS.slots, value),
    booking: (id: string) => store.get<StoredBooking>(NS, CLINIC_COLLECTIONS.bookings, id),
    bookings: (filter?: Partial<StoredBooking>) => store.list<StoredBooking>(NS, CLINIC_COLLECTIONS.bookings, filter),
    putBooking: (value: StoredBooking) => store.put(NS, CLINIC_COLLECTIONS.bookings, { ...value, updatedAt: clock.nowIso() }),
    task: (id: string) => store.get<StoredTask>(NS, CLINIC_COLLECTIONS.tasks, id),
    tasks: (clinicId: string) => store.list<StoredTask>(NS, CLINIC_COLLECTIONS.tasks, { clinicId }),
    putTask: (value: StoredTask) => store.put(NS, CLINIC_COLLECTIONS.tasks, value),
    quote: (id: string) => store.get<StoredQuote>(NS, CLINIC_COLLECTIONS.quotes, id),
    putQuote: (value: StoredQuote) => store.put(NS, CLINIC_COLLECTIONS.quotes, value),
  };
}

export type ClinicStore = ReturnType<typeof clinicStore>;

/** Clinic by id ("cln_mint") or by URL slug ("mint"): the A2A route may hand over either. */
export async function resolveClinic(idOrSlug: string, db: ClinicStore = clinicStore()): Promise<ClinicProfile | undefined> {
  const byId = await db.profile(idOrSlug);
  if (byId) return byId;
  const [bySlug] = await db.store.list<ClinicProfile>(NS, CLINIC_COLLECTIONS.profiles, { slug: idOrSlug });
  return bySlug;
}

/** Operation facts, falling back to the profile when the seed carried no operation record. */
export async function operationOf(profile: ClinicProfile, db: ClinicStore = clinicStore()): Promise<ClinicOperation> {
  const stored = await db.operation(profile.id);
  if (stored) return stored;
  return {
    id: profile.id,
    mode: profile.operationMode,
    dataSources: profile.operationMode === "proxy" ? ["sms", "public_web"] : ["clinic_input"],
    lastVerifiedAt: clock.today(),
    foreignPatientFacilityRegistered: Boolean(profile.foreignPatientFacilityRegNo),
  };
}

/** Short random id with a prefix, matching the wire id pattern `prefix_[A-Za-z0-9_]+`. */
export function newId(prefix: string): string {
  return `${prefix}_${globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** The pibu/booking@1 view of a stored booking. */
export function bookingWire(booking: StoredBooking): BookingV1 {
  const wire: BookingV1 = {
    schema: "pibu/booking@1",
    bookingId: booking.id,
    requestId: booking.request.requestId,
    quoteId: booking.quoteId,
    clinicId: booking.clinicId,
    customerAgentId: booking.customerAgentId,
    slot: booking.request.slot,
    status: booking.status,
    priceKrw: booking.priceKrw,
    referralToken: booking.referralToken,
  };
  if (booking.confirmedBy) wire.confirmedBy = booking.confirmedBy;
  return wire;
}

export type { BookingRequestV1 };
