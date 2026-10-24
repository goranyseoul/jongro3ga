import type { BookingRequestV1, OutcomeV1, ProcedureRequestV1, QuoteV1 } from "../../a2a/schemas";
import type { ConsentEntry, CustomerProfile } from "../../domain/customer";
import type { Store } from "../../store/types";
import { clock } from "../../clock";
import { C, NS, listOf, newId } from "./store";

// Consent ledger (02 "동의 관리", 08 section 5). The agent checks the ledger before anything leaves it, and
// the clinic copy of a procedure request keeps exactly the 03 field list.

export class ConsentError extends Error {
  constructor(
    public readonly consent: ConsentEntry["type"],
    message = `consent ${consent} is required`,
  ) {
    super(message);
    this.name = "ConsentError";
  }
}

/** Latest entry per consent type: a change is appended as a new entry, the newest wins. */
export function latestConsents(entries: ConsentEntry[]): Map<ConsentEntry["type"], ConsentEntry> {
  const latest = new Map<ConsentEntry["type"], ConsentEntry>();
  for (const entry of [...entries].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) latest.set(entry.type, entry);
  return latest;
}

export function granted(entries: ConsentEntry[], type: ConsentEntry["type"]): ConsentEntry | undefined {
  const entry = latestConsents(entries).get(type);
  return entry?.granted ? entry : undefined;
}

/** "safetyInfo.*" covers "safetyInfo.allergies"; other scope entries match exactly. */
export function scopeCovers(scope: readonly string[], field: string): boolean {
  return scope.some((pattern) => (pattern.endsWith(".*") ? field === pattern.slice(0, -2) || field.startsWith(pattern.slice(0, -1)) : pattern === field));
}

export async function consentsOf(store: Store, customerId: string): Promise<ConsentEntry[]> {
  return listOf<ConsentEntry>(store, C.consents, { customerId });
}

/** Appends a ledger entry that switches `type` on or off with the scope of the previous entry. */
export async function setConsent(store: Store, customerId: string, type: ConsentEntry["type"], value: boolean): Promise<ConsentEntry> {
  if ((type === "terms" || type === "privacy") && !value) throw new ConsentError(type, `${type} is required and cannot be switched off`);
  const previous = latestConsents(await consentsOf(store, customerId)).get(type);
  const entry: ConsentEntry = {
    id: newId("cns"),
    customerId,
    type,
    granted: value,
    scope: previous?.scope ?? defaultScope(type),
    ...(previous?.recipientRole ? { recipientRole: previous.recipientRole } : {}),
    textVersion: previous?.textVersion ?? "2026-10-24.v1",
    at: clock.nowIso(),
  };
  await store.put(NS, C.consents, entry);
  return entry;
}

function defaultScope(type: ConsentEntry["type"]): string[] {
  switch (type) {
    case "shareWithClinic":
      return ["safetyInfo.*", "contact.handle"];
    case "shareAnonymizedRecords":
      return ["records.*"];
    case "sensitiveHealth":
      return ["skin.*", "safety.*", "history.*"];
    default:
      return ["profile.*"];
  }
}

/**
 * Copy sent to platform.match_clinics. The visitor profile is profile data under the privacy consent;
 * without it nothing leaves the agent. The platform needs residency and ageBand for eligibility (03).
 */
export function platformRequestCopy(request: ProcedureRequestV1, consents: ConsentEntry[]): ProcedureRequestV1 {
  if (!granted(consents, "privacy")) throw new ConsentError("privacy");
  return request;
}

/**
 * Copy sent to clinic.quote: exactly schema, requestId, customerAgentId, procedureId, productPreference, amount,
 * areas, languages, dateWindow, visitorProfile.nationality, visitorProfile.firstKProcedure (03 field rules).
 * Anything else (notes, budgetKrw, residency, ageBand, unknown fields) is dropped by construction.
 */
export function clinicRequestCopy(request: ProcedureRequestV1): ProcedureRequestV1 {
  const copy: ProcedureRequestV1 = {
    schema: request.schema,
    requestId: request.requestId,
    customerAgentId: request.customerAgentId,
    procedureId: request.procedureId,
    amount: { value: request.amount.value, unit: request.amount.unit },
    languages: [...request.languages],
    dateWindow: { from: request.dateWindow.from, to: request.dateWindow.to },
    visitorProfile: { nationality: request.visitorProfile.nationality },
  };
  if (request.productPreference !== undefined) copy.productPreference = request.productPreference;
  if (request.areas !== undefined) copy.areas = [...request.areas];
  if (request.visitorProfile.firstKProcedure !== undefined) copy.visitorProfile.firstKProcedure = request.visitorProfile.firstKProcedure;
  return copy;
}

/**
 * pibu/booking-request@1 for a chosen quote. Contact and safety info go only under the shareWithClinic consent
 * and its scope; safety info additionally needs the sensitive health consent (08 section 5).
 */
export function bookingRequestFor(args: {
  profile: CustomerProfile;
  consents: ConsentEntry[];
  quote: Pick<QuoteV1, "quoteId" | "clinicId">;
  requestId: string;
  slot: string;
}): BookingRequestV1 {
  const { profile, consents, quote, requestId, slot } = args;
  const share = granted(consents, "shareWithClinic");
  if (!share) throw new ConsentError("shareWithClinic");
  if (!scopeCovers(share.scope, "contact.handle")) throw new ConsentError("shareWithClinic", "contact.handle is not in the clinic sharing scope");
  const request: BookingRequestV1 = {
    schema: "pibu/booking-request@1",
    requestId,
    quoteId: quote.quoteId,
    clinicId: quote.clinicId,
    slot,
    guest: {
      displayName: profile.nickname,
      contactChannel: profile.contact.channel,
      contactHandle: profile.contact.handle,
      language: profile.locale,
    },
    consentRef: share.id,
  };
  if (scopeCovers(share.scope, "safetyInfo.pregnantOrBreastfeeding") && granted(consents, "sensitiveHealth")) {
    const { pregnantOrBreastfeeding, allergies, anticoagulants, recentIsotretinoin, keloidHistory } = profile.safety;
    request.safetyInfo = {
      pregnantOrBreastfeeding,
      allergies: [...allergies],
      ...(anticoagulants === undefined ? {} : { anticoagulants }),
      ...(recentIsotretinoin === undefined ? {} : { recentIsotretinoin }),
      ...(keloidHistory === undefined ? {} : { keloidHistory }),
    };
  }
  return request;
}

/** Outcomes go to the platform only with the anonymized sharing consent. */
export function mayShareOutcome(consents: ConsentEntry[]): boolean {
  return Boolean(granted(consents, "shareAnonymizedRecords"));
}

/** Values the agent may answer for a clinic's pibu/input-request@1 without asking the customer. */
export function consentedAnswers(profile: CustomerProfile, consents: ConsentEntry[]): Record<string, string> {
  const share = granted(consents, "shareWithClinic");
  if (!share) return {};
  const values: Record<string, string> = { displayName: profile.nickname, language: profile.locale, nationality: profile.nationality };
  if (scopeCovers(share.scope, "contact.handle")) {
    values.contactHandle = profile.contact.handle;
    values.contactChannel = profile.contact.channel;
  }
  return values;
}

export type OutcomeVisitor = OutcomeV1["visitorProfile"];
