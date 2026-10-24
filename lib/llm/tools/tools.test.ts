import { describe, expect, it } from "vitest";
import { ProcedureRequestV1Schema } from "../../a2a/schemas";
import {
  TOOL_NAMES,
  buildProcedureRequest,
  missingRequiredSlots,
  openObjectPaths,
  sanitizeRuleDrafts,
  toolDefinition,
  toolJsonSchema,
  toolResultBlock,
  unsupportedKeywordPaths,
  validateToolInput,
  type CustomerOnboardingDraft,
  type DraftProcedureRequest,
  type SanitizedRules,
  type ToolName,
} from ".";

// T07 수용 기준 "도구 입력 zod 검증 실패 시 도구 에러 반환" (10-build-plan.md), and the 07 guardrails.

const FULL_YUKI: CustomerOnboardingDraft = {
  locale: "ja",
  consents: { terms: true, privacy: true, sensitiveHealth: true, crossBorder: true, shareAnonymizedRecords: true },
  nickname: "ゆき",
  nationality: "JP",
  residency: "short_term_visitor",
  ageBand: "25-29",
  trip: { arrival: "2026-11-13", departure: "2026-11-15", stayArea: "sinsa" },
  skin: { concerns: ["elasticity", "fine_lines"] },
  safety: { pregnantOrBreastfeeding: false, allergies: [] },
  prefs: { languagesNeeded: ["ja"], budgetKrw: { max: 450000 } },
  contact: { channel: "line", handle: "yuki_tokyo" },
};

const YUKI_DRAFT: DraftProcedureRequest = {
  procedureId: "rejuran_healer",
  amount: { value: 2, unit: "cc" },
  budgetKrw: { max: 450000 },
  areas: ["sinsa", "gangnam", "apgujeong"],
  languages: ["ja"],
  dateWindow: { from: "2026-11-13", to: "2026-11-15" },
  visitorProfile: { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true },
};

const KNOWN = ["cln_seoul_glow", "cln_mint", "cln_ara"];
const araRule = {
  when: { nationalities: ["JP"] },
  then: { kind: "exclude_clinic", clinicIds: ["cln_ara"] },
  reason: "견적 대비 실결제 평균 +31% (n=20)",
  evidence: { outcomeIds: ["out_1"], signalIds: [], summary: "실결제가 견적보다 평균 31% 높았어요." },
  origin: "trigger",
};

/** One valid and one invalid input per tool. The valid one is the positive control of each failure. */
const CASES: Record<ToolName, { valid: unknown; invalid: unknown[] }> = {
  update_profile: {
    valid: { patch: { nickname: "ゆき", ageBand: "25-29", trip: { arrival: "2026-11-13", departure: "2026-11-15" } } },
    invalid: [
      { patch: { ageBand: "29" } },
      { patch: { nickname: "ゆき", favoriteColor: "red" } },
      { patch: { trip: { arrival: "2026-11-15", departure: "2026-11-13" } } },
      { nickname: "ゆき" },
    ],
  },
  show_widget: {
    valid: { type: "chips", slot: "ageBand", options: [{ value: "25-29", label: "25-29" }] },
    invalid: [{ type: "carousel", slot: "ageBand" }, { type: "chips", slot: "favoriteColor" }],
  },
  request_consent: {
    valid: { consentType: "sensitiveHealth" },
    invalid: [{ consentType: "marketing" }, { consentType: "commissionAgreement" }],
  },
  finish_onboarding: { valid: {}, invalid: [{ force: true }] },
  draft_procedure_request: {
    valid: YUKI_DRAFT,
    invalid: [
      { ...YUKI_DRAFT, procedureId: "rejuran_hb_super" },
      { ...YUKI_DRAFT, languages: [] },
      { ...YUKI_DRAFT, dateWindow: { from: "2026-11-15", to: "2026-11-13" } },
    ],
  },
  extract_menu_items: {
    valid: {
      items: [
        {
          procedureId: "rejuran_healer",
          product: "Rejuran Healer",
          amount: { value: 2, unit: "cc" },
          priceKrw: 340000,
          vatIncluded: true,
          includes: [],
          sourceText: "리쥬란 힐러 2cc 34만원 (VAT 포함)",
        },
      ],
    },
    invalid: [
      { items: [{ procedureId: "rejuran_healer", product: "Rejuran", amount: { value: 2, unit: "ml" }, priceKrw: 1, vatIncluded: true, includes: [], sourceText: "x" }] },
      { items: [{ procedureId: "made_up", product: "x", amount: { value: 1, unit: "cc" }, priceKrw: -5, vatIncluded: true, includes: [], sourceText: "x" }] },
    ],
  },
  propose_rules: { valid: { rules: [araRule] }, invalid: [{ rules: "exclude ara" }, {}] },
};

describe("tool JSON Schemas", () => {
  it.each(TOOL_NAMES)("%s is closed, states required, and keeps only strict mode keywords", (name) => {
    const schema = toolJsonSchema(name);
    expect(schema.type).toBe("object");
    expect(schema.additionalProperties).toBe(false);
    expect(Array.isArray(schema.required)).toBe(true);
    expect(openObjectPaths(schema)).toEqual([]);
    expect(unsupportedKeywordPaths(schema)).toEqual([]);
    expect(toolDefinition(name).strict).toBe(true);
  });

  it("keeps the procedure master enum so Claude cannot invent an id", () => {
    const procedureId = (toolJsonSchema("draft_procedure_request").properties as Record<string, { enum?: string[] }>).procedureId;
    expect(procedureId.enum).toContain("rejuran_healer");
    expect(procedureId.enum).toContain("unknown");
    expect(procedureId.enum).toHaveLength(28);
  });

  it("the clinic update_profile has the clinic slots, not the customer ones", () => {
    const patch = (toolJsonSchema("update_profile", { kind: "clinic" }).properties as Record<string, { properties: object }>).patch;
    expect(Object.keys(patch.properties)).toContain("medicalInstitutionId");
    expect(Object.keys(patch.properties)).not.toContain("nickname");
  });

  it("the checks catch an open object and a dropped keyword (positive control)", () => {
    expect(openObjectPaths({ type: "object", properties: { a: { type: "object", properties: {} } }, additionalProperties: false, required: [] })).toEqual([
      "$.properties.a",
    ]);
    expect(unsupportedKeywordPaths({ type: "object", properties: { n: { type: "integer", minimum: 0 } } })).toEqual(["$.properties.n.minimum"]);
  });
});

describe("validateToolInput", () => {
  const options = { draft: FULL_YUKI, knownClinicIds: KNOWN };

  it.each(TOOL_NAMES)("%s accepts its valid input", (name) => {
    expect(validateToolInput(name, CASES[name].valid, options)).toMatchObject({ ok: true });
  });

  it.each(TOOL_NAMES.flatMap((name) => CASES[name].invalid.map((input, index) => [name, index, input] as const)))(
    "%s rejects invalid input #%i as a tool error",
    (name, _index, input) => {
      const result = validateToolInput(name, input, options);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
    },
  );

  it("rejects an unknown tool", () => {
    expect(validateToolInput("book_now", {})).toEqual({ ok: false, error: "unknown tool book_now" });
  });

  it("refuses skin, safety and history before the sensitiveHealth consent (04 rule 3)", () => {
    const noConsent: CustomerOnboardingDraft = { locale: "ja", consents: { terms: true, privacy: true } };
    const skin = { patch: { skin: { concerns: ["elasticity"] } } };
    expect(validateToolInput("update_profile", skin, { draft: noConsent })).toMatchObject({ ok: false });
    expect(validateToolInput("update_profile", { patch: { safety: { pregnantOrBreastfeeding: false } } }, { draft: noConsent })).toMatchObject({ ok: false });
    // positive controls: after the consent, or with the consent in the same patch
    expect(validateToolInput("update_profile", skin, { draft: { ...noConsent, consents: { sensitiveHealth: true } } })).toMatchObject({ ok: true });
    expect(validateToolInput("update_profile", { patch: { consents: { sensitiveHealth: true }, skin: { concerns: ["pores"] } } }, { draft: noConsent })).toMatchObject({ ok: true });
  });

  it("finish_onboarding fails while required slots are empty and lists them", () => {
    const partial: CustomerOnboardingDraft = { ...FULL_YUKI, contact: undefined, skin: undefined };
    const result = validateToolInput("finish_onboarding", {}, { draft: partial });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("skin.concerns");
    expect(missingRequiredSlots("customer", FULL_YUKI)).toEqual([]);
    expect(validateToolInput("finish_onboarding", {}, { draft: FULL_YUKI })).toMatchObject({ ok: true });
  });

  it("skips trip and residency for a Korean customer and trip for a resident (04 slot notes)", () => {
    const missingKr = missingRequiredSlots("customer", { ...FULL_YUKI, nationality: "KR", residency: undefined, trip: undefined });
    expect(missingKr).toEqual([]);
    expect(missingRequiredSlots("customer", { ...FULL_YUKI, residency: "resident", trip: undefined })).toEqual([]);
    expect(missingRequiredSlots("customer", { ...FULL_YUKI, trip: undefined })).toEqual(["trip.arrival", "trip.departure"]);
  });

  it("checks widget slots and consent types against the onboarding kind", () => {
    expect(validateToolInput("show_widget", { type: "upload", slot: "menu" }, { kind: "clinic" })).toMatchObject({ ok: true });
    expect(validateToolInput("show_widget", { type: "upload", slot: "menu" })).toMatchObject({ ok: false });
    expect(validateToolInput("request_consent", { consentType: "commissionAgreement" }, { kind: "clinic" })).toMatchObject({ ok: true });
  });

  it("turns a failed validation into an is_error tool_result", () => {
    expect(toolResultBlock("toolu_1", { ok: false, error: "ageBand: invalid" })).toEqual({
      type: "tool_result",
      tool_use_id: "toolu_1",
      content: "ageBand: invalid",
      is_error: true,
    });
    expect(toolResultBlock("toolu_2", { ok: true, data: {} })).not.toHaveProperty("is_error");
  });
});

describe("propose_rules guardrails (07 4절)", () => {
  const sanitize = (rules: unknown[]): SanitizedRules => sanitizeRuleDrafts(rules, { knownClinicIds: KNOWN });

  it("accepts the Ara rule and gives exclude_clinic the 90 day default expiry", () => {
    const { accepted, rejected } = sanitize([araRule]);
    expect(rejected).toEqual([]);
    expect(accepted).toEqual([{ ...araRule, expiresInDays: 90 }]);
  });

  it("drops a rule conditioned on health information", () => {
    const pregnant = { ...araRule, when: { nationalities: ["JP"], safety: { pregnantOrBreastfeeding: true } } };
    const skin = { ...araRule, when: { skinType: "sensitive" } };
    const result = sanitize([pregnant, skin, araRule]);
    expect(result.rejected.map((entry) => entry.reason)).toEqual(["health_condition", "health_condition"]);
    expect(result.accepted).toHaveLength(1);
  });

  it("drops a rule that prices by nationality", () => {
    const surcharge = { ...araRule, then: { kind: "adjust_price", clinicIds: ["cln_mint"], priceMultiplier: 1.2 } };
    const priceCondition = { ...araRule, when: { nationalities: ["CN"], quotedPriceKrw: 300000 } };
    const result = sanitize([surcharge, priceCondition]);
    expect(result.rejected.map((entry) => entry.reason)).toEqual(["nationality_pricing", "nationality_pricing"]);
    // positive control: the budget condition is about the request, not the nationality
    expect(sanitize([{ ...araRule, when: { nationalities: ["JP"], budgetMaxBelowKrw: 200000 } }]).accepted).toHaveLength(1);
  });

  it("drops a rule naming a clinic that is not in the registry", () => {
    const ghost = { ...araRule, then: { kind: "exclude_clinic", clinicIds: ["cln_ghost"] } };
    expect(sanitize([ghost]).rejected).toMatchObject([{ reason: "unknown_clinic" }]);
  });

  it("keeps at most 2 extra patterns and only with outcome evidence", () => {
    const pattern = (clinic: string, outcomeIds: string[]) => ({
      ...araRule,
      origin: "pattern",
      then: { kind: "demote_clinic", clinicIds: [clinic], delta: 0.1 },
      evidence: { ...araRule.evidence, outcomeIds },
    });
    const result = sanitize([pattern("cln_mint", []), pattern("cln_mint", ["o1"]), pattern("cln_seoul_glow", ["o2"]), pattern("cln_ara", ["o3"])]);
    expect(result.rejected.map((entry) => entry.reason)).toEqual(["pattern_without_outcomes", "too_many_patterns"]);
    expect(result.accepted).toHaveLength(2);
  });

  it("validateToolInput reports the dropped drafts instead of failing the whole call", () => {
    const result = validateToolInput("propose_rules", { rules: [araRule, { ...araRule, when: { allergies: ["lidocaine"] } }] }, { knownClinicIds: KNOWN });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const data = result.data as SanitizedRules;
      expect(data.accepted).toHaveLength(1);
      expect(data.rejected).toMatchObject([{ reason: "health_condition" }]);
    }
  });
});

describe("draft_procedure_request output", () => {
  const ids = { requestId: "req_yuki_1", customerAgentId: "cag_7f3k2" };

  it("builds a pibu/procedure-request@1 that passes ProcedureRequestV1Schema", () => {
    const built = buildProcedureRequest(YUKI_DRAFT, ids);
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(ProcedureRequestV1Schema.safeParse(built.request).success).toBe(true);
      expect(built.request).toMatchObject({ schema: "pibu/procedure-request@1", requestId: "req_yuki_1", procedureId: "rejuran_healer" });
      expect(built.request).not.toHaveProperty("followUpQuestion");
    }
  });

  it("refuses to build while the procedure or the amount is missing", () => {
    expect(buildProcedureRequest({ ...YUKI_DRAFT, procedureId: "unknown" }, ids)).toMatchObject({ ok: false, missing: ["procedureId"] });
    const { amount: _amount, ...noAmount } = YUKI_DRAFT;
    void _amount;
    expect(buildProcedureRequest(noAmount, ids)).toMatchObject({ ok: false, missing: ["amount"] });
    expect(buildProcedureRequest(YUKI_DRAFT, { ...ids, customerAgentId: "yuki" })).toMatchObject({ ok: false });
  });
});
