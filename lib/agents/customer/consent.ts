import { EXT } from "../../a2a/cards";
import type { BookingRequestV1, ProcedureRequestV1 } from "../../a2a/schemas";
import type { ConsentEntry, IsoDateTime } from "../../domain";
import type { StoredProfile } from "./store";

// Consent ledger (02 "동의 관리", 03 procedure-request@1 field table and consent extension). Pure functions:
// the caller loads the profile and the ledger, these decide what may leave the agent and which ledger entry
// covers it. "Always check the ledger before sending" means every outgoing personal field is built here.

/** Extension URI for messages that carry personal fields with metadata.consentRef (03 "확장"). */
export const CONSENT_EXT = EXT.consent;

// ---- procedure request copies (03 "필드 규칙") ----

/**
 * The platform copy for platform.match_clinics: every field of the request, residency and ageBand included
 * (the platform needs them for eligibility and matching). Built field by field so nothing unknown slips through.
 */
export function forPlatform(request: ProcedureRequestV1): ProcedureRequestV1 {
  const v = request.visitorProfile;
  return {
    schema: request.schema,
    requestId: request.requestId,
    customerAgentId: request.customerAgentId,
    procedureId: request.procedureId,
    ...(request.productPreference !== undefined ? { productPreference: request.productPreference } : {}),
    amount: request.amount,
    ...(request.budgetKrw !== undefined ? { budgetKrw: request.budgetKrw } : {}),
    ...(request.areas !== undefined ? { areas: request.areas } : {}),
    languages: request.languages,
    dateWindow: request.dateWindow,
    visitorProfile: {
      nationality: v.nationality,
      ...(v.residency !== undefined ? { residency: v.residency } : {}),
      ...(v.ageBand !== undefined ? { ageBand: v.ageBand } : {}),
      ...(v.firstKProcedure !== undefined ? { firstKProcedure: v.firstKProcedure } : {}),
    },
    ...(request.notes !== undefined ? { notes: request.notes } : {}),
  };
}

/** The ten top level fields a clinic copy may have (03: "병원으로 가는 사본에 남는 필드는 정확히"). */
export const CLINIC_FIELDS = [
  "schema",
  "requestId",
  "customerAgentId",
  "procedureId",
  "productPreference",
  "amount",
  "areas",
  "languages",
  "dateWindow",
  "visitorProfile",
] as const;

/** The clinic copy for clinic.quote: no notes, budget, residency or age band; visitorProfile keeps nationality and firstKProcedure. */
export function forClinic(request: ProcedureRequestV1): ProcedureRequestV1 {
  const v = request.visitorProfile;
  return {
    schema: request.schema,
    requestId: request.requestId,
    customerAgentId: request.customerAgentId,
    procedureId: request.procedureId,
    ...(request.productPreference !== undefined ? { productPreference: request.productPreference } : {}),
    amount: request.amount,
    ...(request.areas !== undefined ? { areas: request.areas } : {}),
    languages: request.languages,
    dateWindow: request.dateWindow,
    visitorProfile: {
      nationality: v.nationality,
      ...(v.firstKProcedure !== undefined ? { firstKProcedure: v.firstKProcedure } : {}),
    },
  };
}

// ---- ledger lookups ----

/** The latest granted entry of a type (and recipient role, when given), or undefined. */
export function grantedConsent(
  consents: readonly ConsentEntry[],
  type: ConsentEntry["type"],
  recipientRole?: ConsentEntry["recipientRole"],
): ConsentEntry | undefined {
  // The latest entry wins: a later withdrawal (granted false) overrides an earlier grant.
  const latest = consents
    .filter((c) => c.type === type && (recipientRole === undefined || c.recipientRole === undefined || c.recipientRole === recipientRole))
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  return latest?.granted ? latest : undefined;
}

/** True when the entry's scope covers `path`: exact, or a `prefix.*` wildcard (`safetyInfo.*` covers `safetyInfo.allergies`). */
export function scopeAllows(entry: ConsentEntry | undefined, path: string): boolean {
  if (!entry?.granted) return false;
  return entry.scope.some((scope) =>
    scope.endsWith(".*") ? path === scope.slice(0, -2) || path.startsWith(scope.slice(0, -1)) : scope === path,
  );
}

/**
 * The ledger entry behind the personal fields of a procedure request (visitorProfile: nationality, residency,
 * age band): the customer's processing consent (`privacy`). Without it nothing personal leaves the agent.
 */
export function requestConsentRef(consents: readonly ConsentEntry[]): string | undefined {
  return grantedConsent(consents, "privacy")?.id;
}

// ---- booking request ----

/** guest.contactHandle when the customer did not let the clinic have the handle: the clinic writes through Pibu. */
export const RELAY_CONTACT_HANDLE = "pibu-relay";

export type BookingRequestResult =
  | {
      ok: true;
      request: BookingRequestV1;
      consentRef: string;
      /** Which optional personal fields went out, for the timeline and tests. */
      shared: { safetyInfo: boolean; contactHandle: boolean };
    }
  | { ok: false; reason: "consent_missing" };

/**
 * pibu/booking-request@1 from the profile and the ledger (02 정보 경계: safety info only on booking and only
 * with consent). `safetyInfo` goes out only when the `shareWithClinic` entry covers `safetyInfo.*`, the real
 * contact handle only when it covers `contact.handle`. `consentRef` is the shareWithClinic entry, or the privacy
 * entry when there is none (the guest name and channel still go to the clinic that takes the booking).
 */
export function buildBookingRequest(input: {
  profile: StoredProfile;
  consents: readonly ConsentEntry[];
  requestId: string;
  quoteId: string;
  clinicId: string;
  slot: IsoDateTime;
}): BookingRequestResult {
  const share = grantedConsent(input.consents, "shareWithClinic", "clinic");
  const consentRef = share?.id ?? requestConsentRef(input.consents);
  if (!consentRef) return { ok: false, reason: "consent_missing" };

  const { profile } = input;
  const withSafety = scopeAllows(share, "safetyInfo");
  const withHandle = scopeAllows(share, "contact.handle");
  const s = profile.safety;
  const request: BookingRequestV1 = {
    schema: "pibu/booking-request@1",
    requestId: input.requestId,
    quoteId: input.quoteId,
    clinicId: input.clinicId,
    slot: input.slot,
    guest: {
      displayName: profile.nickname,
      contactChannel: profile.contact.channel,
      contactHandle: withHandle ? profile.contact.handle : RELAY_CONTACT_HANDLE,
      language: profile.locale,
    },
    ...(withSafety
      ? {
          safetyInfo: {
            pregnantOrBreastfeeding: s.pregnantOrBreastfeeding,
            allergies: [...s.allergies],
            ...(s.anticoagulants !== undefined ? { anticoagulants: s.anticoagulants } : {}),
            ...(s.recentIsotretinoin !== undefined ? { recentIsotretinoin: s.recentIsotretinoin } : {}),
            ...(s.keloidHistory !== undefined ? { keloidHistory: s.keloidHistory } : {}),
          },
        }
      : {}),
    consentRef,
  };
  return { ok: true, request, consentRef, shared: { safetyInfo: withSafety, contactHandle: withHandle } };
}

// ---- answering a clinic's input request (TASK_STATE_INPUT_REQUIRED) ----

const yesNo = (value: boolean | undefined): string | undefined => (value === undefined ? undefined : value ? "yes" : "no");

/** Input request keys the agent may answer from the profile, with the consent scope each needs. */
const ANSWERABLE: Record<string, { scope: string; value: (p: StoredProfile) => string | undefined }> = {
  passportName: { scope: "guest.passportName", value: (p) => p.passportName },
  displayName: { scope: "guest.displayName", value: (p) => p.nickname },
  contactHandle: { scope: "contact.handle", value: (p) => p.contact.handle },
  pregnantOrBreastfeeding: { scope: "safetyInfo.pregnantOrBreastfeeding", value: (p) => yesNo(p.safety.pregnantOrBreastfeeding) },
  allergies: { scope: "safetyInfo.allergies", value: (p) => (p.safety.allergies.length > 0 ? p.safety.allergies.join(", ") : "none") },
  anticoagulants: { scope: "safetyInfo.anticoagulants", value: (p) => yesNo(p.safety.anticoagulants) },
  recentIsotretinoin: { scope: "safetyInfo.recentIsotretinoin", value: (p) => yesNo(p.safety.recentIsotretinoin) },
  keloidHistory: { scope: "safetyInfo.keloidHistory", value: (p) => yesNo(p.safety.keloidHistory) },
};

/**
 * The value the agent may send for an input request field without asking, or undefined (the customer answers on
 * the booking screen). Treatment history such as `lastRejuranDate` is never answered automatically: history
 * leaves the device only when the customer types it (INTEGRATION 6).
 */
export function answerFromProfile(key: string, profile: StoredProfile, consents: readonly ConsentEntry[]): string | undefined {
  const rule = ANSWERABLE[key];
  if (!rule) return undefined;
  const share = grantedConsent(consents, "shareWithClinic", "clinic");
  if (!scopeAllows(share, rule.scope)) return undefined;
  const value = rule.value(profile);
  return value === undefined || value.trim() === "" ? undefined : value;
}
