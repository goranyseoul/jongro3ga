import { describe, expect, it } from "vitest";
import customersJson from "../../../data/seed/customers.json";
import { ProcedureRequestForClinicSchema, ProcedureRequestForPlatformSchema, type ProcedureRequestV1 } from "../../a2a/schemas";
import type { ConsentEntry } from "../../domain";
import { CLINIC_FIELDS, RELAY_CONTACT_HANDLE, answerFromProfile, buildBookingRequest, forClinic, forPlatform, grantedConsent, requestConsentRef, scopeAllows } from "./consent";
import type { StoredProfile } from "./store";

// Consent ledger (02 동의 관리, 03 procedure-request@1 field table). Positive controls: the same functions keep
// what they may send, so a check that strips everything would fail too.

const consents = customersJson.consents as ConsentEntry[];
const yukiConsents = consents.filter((c) => c.customerId === "cus_yuki_done");
const yuki = customersJson.profiles.find((p) => p.id === "cus_yuki_done") as StoredProfile;

const full: ProcedureRequestV1 = {
  schema: "pibu/procedure-request@1",
  requestId: "req_01J9Z8",
  customerAgentId: "cag_7f3k2d",
  procedureId: "rejuran_healer",
  productPreference: "any",
  amount: { value: 2, unit: "cc" },
  budgetKrw: { max: 450_000 },
  areas: ["sinsa", "gangnam", "apgujeong"],
  languages: ["ja"],
  dateWindow: { from: "2026-11-13", to: "2026-11-15" },
  visitorProfile: { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true },
  notes: "Prefer short downtime, flying home on 11-15 evening",
};

describe("procedure request copies (03 필드 규칙)", () => {
  it("the clinic copy has exactly the ten fields and no notes, budget, residency or age band", () => {
    const copy = forClinic(full);
    expect(Object.keys(copy).sort()).toEqual([...CLINIC_FIELDS].sort());
    expect(Object.keys(copy)).toHaveLength(10);
    expect(copy).not.toHaveProperty("notes");
    expect(copy).not.toHaveProperty("budgetKrw");
    expect(copy.visitorProfile).toEqual({ nationality: "JP", firstKProcedure: true });
    expect(ProcedureRequestForClinicSchema.safeParse(copy).success).toBe(true);
  });

  it("positive control: the full request is refused by the clinic schema, the platform copy keeps every field", () => {
    expect(ProcedureRequestForClinicSchema.safeParse(full).success).toBe(false);
    const copy = forPlatform(full);
    expect(copy).toEqual(full);
    expect(copy.visitorProfile).toMatchObject({ residency: "short_term_visitor", ageBand: "25-29" });
    expect(copy.notes).toBe(full.notes);
    expect(copy.budgetKrw).toEqual({ max: 450_000 });
    expect(ProcedureRequestForPlatformSchema.safeParse(copy).success).toBe(true);
  });

  it("does not let an unknown field through either copy", () => {
    const sneaky = { ...full, passport: "TK1234567", visitorProfile: { ...full.visitorProfile, city: "Tokyo" } } as unknown as ProcedureRequestV1;
    expect(forClinic(sneaky)).not.toHaveProperty("passport");
    expect(forPlatform(sneaky)).not.toHaveProperty("passport");
    expect(forPlatform(sneaky).visitorProfile).not.toHaveProperty("city");
  });
});

describe("ledger lookups", () => {
  it("finds the granted entry and lets a later withdrawal win", () => {
    expect(requestConsentRef(yukiConsents)).toBe("cns_0002");
    expect(grantedConsent(yukiConsents, "shareWithClinic", "clinic")?.id).toBe("cns_0005");
    const withdrawn: ConsentEntry = { ...yukiConsents.find((c) => c.id === "cns_0005")!, id: "cns_0099", granted: false, at: "2026-11-12T09:00:00+09:00" };
    expect(grantedConsent([...yukiConsents, withdrawn], "shareWithClinic", "clinic")).toBeUndefined();
    expect(grantedConsent(yukiConsents, "shareAnonymizedRecords")).toBeUndefined();
  });

  it("matches scopes exactly or by a .* wildcard", () => {
    const share = grantedConsent(yukiConsents, "shareWithClinic", "clinic");
    expect(scopeAllows(share, "safetyInfo")).toBe(true);
    expect(scopeAllows(share, "safetyInfo.allergies")).toBe(true);
    expect(scopeAllows(share, "contact.handle")).toBe(true);
    expect(scopeAllows(share, "contact.channel")).toBe(false);
    expect(scopeAllows(share, "guest.passportName")).toBe(false);
    expect(scopeAllows(undefined, "contact.handle")).toBe(false);
  });
});

describe("booking request (02 정보 경계: safety info only with consent)", () => {
  const base = { profile: yuki, requestId: "req_01J9Z8", quoteId: "qt_1203", clinicId: "cln_seoul_glow", slot: "2026-11-14T11:00:00+09:00" };

  it("positive control: with shareWithClinic consent it sends safety info and the real handle, consentRef = that entry", () => {
    const result = buildBookingRequest({ ...base, consents: yukiConsents });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.consentRef).toBe("cns_0005");
    expect(result.request.consentRef).toBe("cns_0005");
    expect(result.request.safetyInfo).toEqual({ pregnantOrBreastfeeding: false, allergies: [], anticoagulants: false, recentIsotretinoin: false, keloidHistory: false });
    expect(result.request.guest).toEqual({ displayName: "Yuki", contactChannel: "line", contactHandle: "yuki_demo", language: "ja" });
  });

  it("without shareWithClinic consent: no safety info, no contact handle, consentRef = the privacy entry", () => {
    const result = buildBookingRequest({ ...base, consents: yukiConsents.filter((c) => c.type !== "shareWithClinic") });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.request).not.toHaveProperty("safetyInfo");
    expect(result.request.guest.contactHandle).toBe(RELAY_CONTACT_HANDLE);
    expect(result.request.consentRef).toBe("cns_0002");
    expect(result.shared).toEqual({ safetyInfo: false, contactHandle: false });
  });

  it("with a contact-only scope: the handle goes, safety info does not", () => {
    const contactOnly = yukiConsents.map((c) => (c.id === "cns_0005" ? { ...c, scope: ["contact.handle"] } : c));
    const result = buildBookingRequest({ ...base, consents: contactOnly });
    expect(result.ok && result.request.guest.contactHandle).toBe("yuki_demo");
    expect(result.ok && result.request.safetyInfo).toBeUndefined();
  });

  it("refuses to build anything with an empty ledger", () => {
    expect(buildBookingRequest({ ...base, consents: [] })).toEqual({ ok: false, reason: "consent_missing" });
  });
});

describe("answering a clinic's input request", () => {
  it("answers only what the scope covers and never treatment history", () => {
    const withPassport: StoredProfile = { ...yuki, passportName: "TANAKA YUKI" };
    expect(answerFromProfile("allergies", withPassport, yukiConsents)).toBe("none");
    expect(answerFromProfile("contactHandle", withPassport, yukiConsents)).toBe("yuki_demo");
    expect(answerFromProfile("passportName", withPassport, yukiConsents)).toBeUndefined();
    const passportScope = yukiConsents.map((c) => (c.id === "cns_0005" ? { ...c, scope: [...c.scope, "guest.passportName"] } : c));
    expect(answerFromProfile("passportName", withPassport, passportScope)).toBe("TANAKA YUKI");
    expect(answerFromProfile("lastRejuranDate", withPassport, passportScope)).toBeUndefined();
  });
});
