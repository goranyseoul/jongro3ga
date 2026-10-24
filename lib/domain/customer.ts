import type { BookingV1, FairnessVerdictV1, OutcomeV1, ProcedureRequestV1, QuoteV1 } from "../a2a/schemas";
import type { Amount, AgeBand, Area, Concern, IsoDate, IsoDateTime, Krw, Locale, Nationality } from "./common";

// Entities of the `customer` store namespace, docs/spec/06-data-model.md.
// OnboardingSession is listed there but has no interface yet (04 only names its fields), so it is left out.

export interface CustomerAccount {
  id: string;
  email?: string;
  demoPersona?: string;
  agentId: string;
  createdAt: IsoDateTime;
}

export interface CustomerProfile {
  /** Same as CustomerAccount.id. */
  id: string;
  /** Pseudonymous agent id such as "cag_7f3k2". */
  agentId: string;
  locale: Locale;
  nickname: string;
  nationality: Nationality;
  /** Foreign nationals only, undefined for KR. */
  residency?: "short_term_visitor" | "resident";
  ageBand: AgeBand;
  trip?: { arrival: IsoDate; departure: IsoDate; stayArea?: Area; flightTimeHome?: string };
  skin: { type?: "dry" | "oily" | "combination" | "sensitive" | "unknown"; concerns: Concern[] };
  safety: {
    pregnantOrBreastfeeding: boolean;
    allergies: string[];
    anticoagulants?: boolean;
    recentIsotretinoin?: boolean;
    keloidHistory?: boolean;
  };
  prefs: {
    budgetKrw?: { max: Krw };
    downtimeToleranceDays?: number;
    painTolerance?: "low" | "mid" | "high";
    languagesNeeded: Locale[];
    doctorGender?: "any" | "female";
  };
  contact: { channel: "email" | "line" | "wechat" | "whatsapp"; handle: string };
  completedAt?: IsoDateTime;
}

export interface ConsentEntry {
  id: string;
  customerId: string;
  type: "terms" | "privacy" | "sensitiveHealth" | "crossBorder" | "shareAnonymizedRecords" | "shareWithClinic";
  granted: boolean;
  /** Field paths that may be shared, e.g. ["safetyInfo.*", "contact.handle"]. */
  scope: string[];
  recipientRole?: "platform" | "clinic";
  /** Version of the consent wording, e.g. "2026-10-24.v1". */
  textVersion: string;
  at: IsoDateTime;
}

export interface TreatmentRecord {
  id: string;
  customerId: string;
  procedureId: string;
  date: IsoDate;
  amount?: Amount;
  priceKrw?: Krw;
  /** Set when the clinic is in the registry. */
  clinicId?: string;
  /** Free text when it is not. */
  clinicName?: string;
  source: "manual" | "booking" | "onboarding_history";
  receiptImage?: string;
  rating?: 1 | 2 | 3 | 4 | 5;
  note?: string;
  /** Consecutive session of the same procedure, starting at 1. */
  sessionNumber: number;
  nextDue?: IsoDate;
  status: "active" | "paused" | "stopped";
  stopReason?: "no_effect" | "expensive" | "side_effect" | "other";
  sharedToPlatform: boolean;
}

export interface CustomerRequest {
  /** "req_..." and also the A2A contextId. */
  id: string;
  customerId: string;
  rawUtterance: string;
  request: ProcedureRequestV1;
  status: "draft" | "matching" | "quoting" | "judging" | "comparing" | "booking" | "booked" | "closed" | "failed";
  matchId?: string;
  createdAt: IsoDateTime;
}

export interface ReceivedQuote {
  id: string;
  requestId: string;
  quote: QuoteV1;
  verdict?: FairnessVerdictV1;
  taskId: string;
  receivedAt: IsoDateTime;
}

export interface CustomerBooking {
  id: string;
  requestId: string;
  clinicId: string;
  clinicTaskId: string;
  booking?: BookingV1;
  status: BookingV1["status"] | "requested";
}

export interface OutcomeDraft {
  id: string;
  bookingId: string;
  checkpoint: "D0" | "D7" | "D30";
  dueAt: IsoDateTime;
  outcome?: OutcomeV1;
  sentAt?: IsoDateTime;
}
