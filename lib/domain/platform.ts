import type {
  BookingV1,
  ClinicShortlistV1,
  FairnessVerdictV1,
  JudgeRequestV1,
  OffersV1,
  OutcomeV1,
  ProcedureRequestV1,
} from "../a2a/schemas";
import type {
  AgeBand,
  Amount,
  Area,
  I18nText,
  IsoDate,
  IsoDateTime,
  Krw,
  Locale,
  Nationality,
} from "./common";
import type { LanguageSupport } from "./clinic";

// Entities of the `platform` store namespace, docs/spec/06-data-model.md.

export interface ClinicRegistryEntry {
  /** "cln_mint" */
  id: string;
  slug: string;
  name: I18nText;
  area: Area;
  agentCardUrl: string;
  operationMode: "proxy" | "clinic";
  dataSources: ("sms" | "public_web" | "clinic_input")[];
  lastVerifiedAt: IsoDate;
  foreignPatientFacilityRegistered: boolean;
  verificationStatus: "verified" | "pending_verification" | "suspended";
  /** Matching hard filter and fit both need the mode, not just the locale. */
  languages: LanguageSupport[];
}

export interface PriceRecord {
  id: string;
  procedureId: string;
  product?: string;
  area: Area;
  amount: Amount;
  /** Actually paid, normalized to VAT included. */
  paidKrw: Krw;
  /** paidKrw / amount.value */
  normalizedUnitKrw: Krw;
  /** public_offer is reference only and never part of a verdict sample. */
  source: "outcome" | "shared_record" | "public_offer";
  /** Receipt or booking linked payment. */
  verified: boolean;
  ageBand?: AgeBand;
  nationalityGroup?: "KR" | "foreign";
  clinicId?: string;
  date: IsoDate;
}

/** Cached clinic.offers A2A response. */
export interface ClinicOfferCache {
  id: string;
  clinicId: string;
  offers: OffersV1;
  fetchedAt: IsoDateTime;
}

/** Kept to compute an outcome's quoteGapRatio later. */
export interface JudgedQuote {
  id: string;
  quoteId: string;
  matchId: string;
  clinicId: string;
  quote: JudgeRequestV1["quotes"][number];
  verdict: FairnessVerdictV1;
  at: IsoDateTime;
}

export interface Outcome extends OutcomeV1 {
  id: string;
  receivedAt: IsoDateTime;
  quotedKrw?: Krw;
  quoteGapRatio?: number;
}

export interface RoutingRule {
  /** "rule_012" */
  id: string;
  version: number;
  status: "proposed" | "active" | "rejected" | "retired";
  when: RuleCondition;
  then: RuleAction;
  /** Human readable reason, Korean. */
  reason: string;
  evidence: { outcomeIds: string[]; signalIds: string[]; summary: string };
  source: "operator" | "auto_proposal";
  /** "claude-opus-5-5" or an operator id. */
  proposedBy?: string;
  approvedBy?: string;
  createdAt: IsoDateTime;
  activatedAt?: IsoDateTime;
  expiresAt?: IsoDateTime;
  appliedCount: number;
}

/** Evaluated against the request only. Clinics are named by RuleAction.clinicIds. */
export interface RuleCondition {
  procedureIds?: string[];
  nationalities?: Nationality[];
  languages?: Locale[];
  areas?: Area[];
  ageBands?: AgeBand[];
  firstKProcedure?: boolean;
  budgetMaxBelowKrw?: Krw;
}

export type RuleAction =
  | { kind: "exclude_clinic"; clinicIds: string[] }
  | { kind: "boost_clinic"; clinicIds: string[]; delta: number }
  | { kind: "demote_clinic"; clinicIds: string[]; delta: number }
  | { kind: "prefer_area"; areas: Area[]; delta: number }
  | { kind: "require_language"; languages: Locale[] };

export interface MatchLog {
  /** "mt_4401" */
  id: string;
  requestId: string;
  customerAgentId: string;
  request: ProcedureRequestV1;
  candidatesBeforeRules: { clinicId: string; score: number }[];
  appliedRuleIds: string[];
  result: ClinicShortlistV1;
  at: IsoDateTime;
}

export interface AttributionEntry {
  id: string;
  bookingId: string;
  clinicId: string;
  customerAgentId: string;
  matchId: string;
  referralTokenJti: string;
  status: BookingV1["status"];
  priceKrw: Krw;
  nationality?: Nationality;
  reportedAt: IsoDateTime;
}

export interface Signal {
  id: string;
  clinicId: string;
  kind:
    | "quote_gap"
    | "low_satisfaction"
    | "response_timeout"
    | "rejection"
    | "no_show"
    | "side_effect_report"
    | "underdosed_offer";
  value: number;
  context: { nationality?: Nationality; procedureId?: string; outcomeId?: string; taskId?: string };
  at: IsoDateTime;
}
