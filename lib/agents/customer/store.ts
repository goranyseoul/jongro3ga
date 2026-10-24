import type { ClinicShortlistV1, InputRequestV1 } from "../../a2a/schemas";
import type {
  ConsentEntry,
  CustomerAccount,
  CustomerBooking,
  CustomerProfile,
  CustomerRequest,
  I18nText,
  IsoDateTime,
  OutcomeDraft,
  ReceivedQuote,
  TreatmentRecord,
} from "../../domain";
import { getStore } from "../../store";
import { COLLECTIONS } from "../../store/collections";

// The customer agent's view of the store: the `customer` namespace only (09 "모듈 경계",
// scripts/check-boundaries.mjs). Every read and write of lib/agents/customer goes through this file.
//
// Fields marked "06 extra" are not in docs/spec/06-data-model.md; BUILD-LOG 25 lists them.

const C = COLLECTIONS.customer;

/** Collections this module adds to the customer namespace (lib/store/collections.ts is not ours to edit). */
export const CUSTOMER_EXTRA = {
  /** pibu/notification@1 received through customer.notify. */
  notifications: "notifications",
} as const;

/** 06 extra: a passport name the customer chose to keep, answered to a clinic only with consent (booking.ts). */
export type StoredProfile = CustomerProfile & { passportName?: string };

/** One step of a request that is not an A2A call (device side offer matching, proofs), for the progress screen. */
export interface RequestStep {
  at: IsoDateTime;
  kind:
    | "eligibility"
    | "consent"
    | "offer_match"
    | "proof_attached"
    | "proof_skipped"
    | "quote_missing"
    | "anchor";
  clinicId?: string;
  text: I18nText;
}

/** CustomerRequest (06) plus the 06 extras the orchestrator needs to resume and to explain itself. */
export interface StoredRequest extends CustomerRequest {
  /** 06 extra: progress lines for the steps that are not A2A calls. */
  steps: RequestStep[];
  /** 06 extra: the platform's answer, kept for the referral tokens and card URLs of the booking. */
  shortlist?: ClinicShortlistV1;
  /** 06 extra: why the request ended `failed`, e.g. "not_eligible_foreign_patient", "no_quotes". */
  failure?: { reason: string; at: IsoDateTime };
  /** 06 extra: the comparison summary in the customer's language (summary.ts). */
  summary?: { text: string; mode: "live" | "fixture"; at: IsoDateTime };
  updatedAt: IsoDateTime;
}

/** ReceivedQuote (06) plus the shortlist position, so the comparison keeps the platform's order. */
export interface StoredQuote extends ReceivedQuote {
  /** 06 extra */
  rank: number;
}

/** CustomerBooking (06) plus what the poll and the outcome need. */
export interface StoredBooking extends CustomerBooking {
  /** 06 extra fields below. */
  customerId: string;
  quoteId: string;
  procedureId: string;
  slot: IsoDateTime;
  /** Agent Card URL of the clinic, from the shortlist. */
  clinicCardUrl: string;
  /** Fields the clinic asked for that the agent could not answer from consented profile values. */
  pendingInput?: InputRequestV1["fields"];
  /** Text of a REJECTED, CANCELED or FAILED clinic task. */
  endReason?: string;
  /** The TreatmentRecord created when the booking was confirmed. */
  recordId?: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface StoredNotification {
  id: string;
  customerId: string;
  /** The agent that sent it. */
  from: { agentId: string; role: "platform" | "clinic" | "customer" };
  kind: "booking_confirmed" | "booking_changed" | "reminder" | "notice";
  bookingId?: string;
  text: I18nText;
  receivedAt: IsoDateTime;
}

const store = () => getStore();

export const customerStore = {
  // ---- accounts, profiles, consents ----
  account: (customerId: string) => store().get<CustomerAccount>("customer", C.accounts, customerId),
  async accountByAgent(agentId: string): Promise<CustomerAccount | undefined> {
    const [account] = await store().list<CustomerAccount>("customer", C.accounts, { agentId });
    return account;
  },
  profile: (customerId: string) => store().get<StoredProfile>("customer", C.profiles, customerId),
  putProfile: (profile: StoredProfile) => store().put("customer", C.profiles, profile),
  consents: (customerId: string) => store().list<ConsentEntry>("customer", C.consents, { customerId }),

  // ---- treatment records ----
  records: (customerId: string) => store().list<TreatmentRecord>("customer", C.records, { customerId }),
  record: (id: string) => store().get<TreatmentRecord>("customer", C.records, id),
  putRecord: (record: TreatmentRecord) => store().put("customer", C.records, record),

  // ---- requests and quotes ----
  request: (id: string) => store().get<StoredRequest>("customer", C.requests, id),
  requests: (customerId: string) => store().list<StoredRequest>("customer", C.requests, { customerId }),
  putRequest: (request: StoredRequest) => store().put("customer", C.requests, request),
  async quotes(requestId: string): Promise<StoredQuote[]> {
    const quotes = await store().list<StoredQuote>("customer", C.quotes, { requestId });
    return quotes.sort((a, b) => a.rank - b.rank);
  },
  quote: (quoteId: string) => store().get<StoredQuote>("customer", C.quotes, quoteId),
  putQuote: (quote: StoredQuote) => store().put("customer", C.quotes, quote),
  removeQuote: (quoteId: string) => store().remove("customer", C.quotes, quoteId),

  // ---- bookings and outcomes ----
  booking: (id: string) => store().get<StoredBooking>("customer", C.bookings, id),
  bookings: (filter: Partial<StoredBooking> = {}) => store().list<StoredBooking>("customer", C.bookings, filter),
  putBooking: (booking: StoredBooking) => store().put("customer", C.bookings, booking),
  outcomeDraft: (id: string) => store().get<OutcomeDraft>("customer", C.outcomeDrafts, id),
  outcomeDrafts: (bookingId: string) => store().list<OutcomeDraft>("customer", C.outcomeDrafts, { bookingId }),
  putOutcomeDraft: (draft: OutcomeDraft) => store().put("customer", C.outcomeDrafts, draft),

  // ---- notifications ----
  notifications: (customerId: string) =>
    store().list<StoredNotification>("customer", CUSTOMER_EXTRA.notifications, { customerId }),
  putNotification: (notification: StoredNotification) => store().put("customer", CUSTOMER_EXTRA.notifications, notification),
};

/** A short random id with a prefix that satisfies the wire id patterns (`req_`, `out_`). */
export const newId = (prefix: string): string => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;

/** The booking a wire bookingId (`bkg_`, the clinic's id) or a customer booking id (`cbk_`) names. */
export async function findBooking(id: string): Promise<StoredBooking | undefined> {
  const own = await customerStore.booking(id);
  if (own) return own;
  return (await customerStore.bookings()).find((b) => b.booking?.bookingId === id);
}

/** OutcomeDraft ids are fixed per (clinic booking id, checkpoint), so a resubmission replaces the draft. */
export const outcomeDraftId = (wireBookingId: string, checkpoint: OutcomeDraft["checkpoint"]): string =>
  `od_${wireBookingId}_${checkpoint}`;
