import { describe, expect, it } from "vitest";
import { ProcedureRequestForClinicSchema, parsePibuData, type ProcedureRequestV1 } from "../../a2a/schemas";
import type { ConsentEntry } from "../../domain/customer";
import { ConsentError, bookingRequestFor, clinicRequestCopy, granted, platformRequestCopy, scopeCovers } from "./consent";
import { DEMO_PROFILES, demoConsents } from "./seed";

const yuki = DEMO_PROFILES[0]!;

const fullRequest: ProcedureRequestV1 = {
  schema: "pibu/procedure-request@1",
  requestId: "req_01J9Z8",
  customerAgentId: "cag_7f3k2",
  procedureId: "rejuran_healer",
  productPreference: "any",
  amount: { value: 2, unit: "cc" },
  budgetKrw: { max: 450000 },
  areas: ["sinsa", "gangnam", "apgujeong"],
  languages: ["ja"],
  dateWindow: { from: "2026-11-13", to: "2026-11-15" },
  visitorProfile: { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true },
  notes: "Prefer short downtime, flying home on 11-15 evening",
};

// The 03 field list for the clinic copy, written by hand so the test does not ask the code what it keeps.
const CLINIC_FIELDS = ["schema", "requestId", "customerAgentId", "procedureId", "productPreference", "amount", "areas", "languages", "dateWindow", "visitorProfile"];
const CLINIC_VISITOR_FIELDS = ["nationality", "firstKProcedure"];

describe("clinic copy of a procedure request (03 field rules, 08 section 5)", () => {
  it("keeps exactly the 03 field list and drops notes, budget, residency and age band", () => {
    const copy = clinicRequestCopy(fullRequest);
    expect(Object.keys(copy).sort()).toEqual([...CLINIC_FIELDS].sort());
    expect(Object.keys(copy.visitorProfile).sort()).toEqual([...CLINIC_VISITOR_FIELDS].sort());
    expect(copy).not.toHaveProperty("notes");
    expect(copy).not.toHaveProperty("budgetKrw");
    expect(copy.visitorProfile).not.toHaveProperty("residency");
    expect(copy.visitorProfile).not.toHaveProperty("ageBand");
  });

  it("passes the clinic.quote schema that rejects minimization violations, while the full request fails it", () => {
    expect(ProcedureRequestForClinicSchema.safeParse(clinicRequestCopy(fullRequest)).success).toBe(true);
    expect(ProcedureRequestForClinicSchema.safeParse(fullRequest).success).toBe(false); // positive control
    expect(parsePibuData("clinic.quote", clinicRequestCopy(fullRequest)).ok).toBe(true);
  });

  it("drops fields it does not know even if a caller smuggles them in", () => {
    const smuggled = { ...fullRequest, safety: { pregnantOrBreastfeeding: true }, history: ["2026-10-01 rejuran"] } as unknown as ProcedureRequestV1;
    const copy = clinicRequestCopy(smuggled) as unknown as Record<string, unknown>;
    expect(copy.safety).toBeUndefined();
    expect(copy.history).toBeUndefined();
  });

  it("does not send profile fields to the platform without the privacy consent", () => {
    const consents = demoConsents(yuki, 0);
    expect(platformRequestCopy(fullRequest, consents)).toBe(fullRequest);
    const withoutPrivacy = consents.map((c) => (c.type === "privacy" ? { ...c, granted: false } : c));
    expect(() => platformRequestCopy(fullRequest, withoutPrivacy)).toThrow(ConsentError);
  });
});

describe("booking request and the consent ledger", () => {
  const quote = { quoteId: "qt_1203", clinicId: "cln_seoul_glow" };
  const slot = "2026-11-14T11:00:00+09:00";

  it("sends contact and safety info under the clinic sharing consent with its consentRef", () => {
    const consents = demoConsents(yuki, 0);
    const request = bookingRequestFor({ profile: yuki, consents, quote, requestId: "req_01J9Z8", slot });
    expect(request.consentRef).toBe(granted(consents, "shareWithClinic")?.id);
    expect(request.guest.contactHandle).toBe("yuki_demo");
    expect(request.safetyInfo).toEqual({ pregnantOrBreastfeeding: false, allergies: [], anticoagulants: false, recentIsotretinoin: false, keloidHistory: false });
    expect(parsePibuData("clinic.book", request).ok).toBe(true);
  });

  it("leaves safety info out when the sensitive health consent was switched off (newest entry wins)", () => {
    const consents: ConsentEntry[] = [
      ...demoConsents(yuki, 0),
      { id: "cns_9001", customerId: yuki.id, type: "sensitiveHealth", granted: false, scope: ["skin.*", "safety.*"], textVersion: "v1", at: "2026-10-24T11:00:00+09:00" },
    ];
    const request = bookingRequestFor({ profile: yuki, consents, quote, requestId: "req_01J9Z8", slot });
    expect(request.safetyInfo).toBeUndefined();
  });

  it("refuses to book without the clinic sharing consent", () => {
    const consents = demoConsents(yuki, 0).filter((c) => c.type !== "shareWithClinic");
    expect(() => bookingRequestFor({ profile: yuki, consents, quote, requestId: "req_01J9Z8", slot })).toThrow(ConsentError);
  });

  it("matches wildcard scopes only on their own prefix", () => {
    expect(scopeCovers(["safetyInfo.*"], "safetyInfo.allergies")).toBe(true);
    expect(scopeCovers(["safetyInfo.*"], "safetyInformation")).toBe(false);
    expect(scopeCovers(["contact.handle"], "contact.channel")).toBe(false);
  });
});
