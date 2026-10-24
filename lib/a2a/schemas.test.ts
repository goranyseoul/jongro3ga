import { describe, expect, it } from "vitest";
import { wireFixtures } from "./__fixtures__/wire";
import {
  INVALID_PARAMS,
  PIBU_SCHEMAS,
  SKILL_IDS,
  SKILL_ROUTES,
  parsePibuData,
  type PibuSchemaName,
} from "./schemas";

const clone = <T>(value: T): T => structuredClone(value);

const fixture = (name: PibuSchemaName, label?: string) => {
  const found = wireFixtures.find((f) => f.name === name && (label === undefined || f.label === label));
  if (!found) throw new Error(`no fixture ${name} ${label ?? ""}`);
  return clone(found.data);
};

const fullRequest = () => fixture("pibu/procedure-request@1");

// The exact copy a clinic may receive (03 "병원으로 가는 사본에 남는 필드").
const clinicCopy = () => {
  const request = fullRequest() as { notes?: string; budgetKrw?: unknown; visitorProfile: Record<string, unknown> };
  delete request.notes;
  delete request.budgetKrw;
  delete request.visitorProfile.residency;
  delete request.visitorProfile.ageBand;
  return request;
};

describe("wire fixtures", () => {
  it("covers every schema name", () => {
    const covered = new Set(wireFixtures.map((f) => f.name));
    expect([...Object.keys(PIBU_SCHEMAS)].filter((name) => !covered.has(name as PibuSchemaName))).toEqual([]);
  });

  it.each(wireFixtures.map((f) => [`${f.name} (${f.label})`, f] as const))("%s passes its schema", (_title, f) => {
    const result = PIBU_SCHEMAS[f.name].safeParse(f.data);
    expect(result.success, JSON.stringify(result.error?.issues)).toBe(true);
  });

  // Written from 03, independent of the schemas, so a field that quietly turns optional is caught.
  const FIELDS: Record<PibuSchemaName, { required: string[]; optional: string[] }> = {
    "pibu/procedure-request@1": {
      required: ["schema", "requestId", "customerAgentId", "procedureId", "amount", "languages", "dateWindow", "visitorProfile"],
      optional: ["productPreference", "budgetKrw", "areas", "notes"],
    },
    "pibu/clinic-shortlist@1": {
      required: ["schema", "requestId", "matchId", "appliedRuleIds", "priceReference", "candidates"],
      optional: [],
    },
    "pibu/quote@1": {
      required: [
        "schema", "quoteId", "requestId", "clinicId", "procedureId", "product", "amount", "priceKrw",
        "vatIncluded", "includes", "excludes", "slots", "languages", "indicative", "validUntil", "operationMode",
      ],
      optional: ["event"],
    },
    "pibu/judge-request@1": { required: ["schema", "requestId", "matchId", "quotes"], optional: [] },
    "pibu/fairness-verdict-list@1": { required: ["schema", "requestId", "verdicts"], optional: [] },
    "pibu/booking-request@1": {
      required: ["schema", "requestId", "quoteId", "clinicId", "slot", "guest", "consentRef"],
      optional: ["safetyInfo"],
    },
    "pibu/booking@1": {
      required: ["schema", "bookingId", "requestId", "quoteId", "clinicId", "customerAgentId", "slot", "status", "priceKrw", "referralToken"],
      optional: ["confirmedBy", "instructions"],
    },
    "pibu/cancel-request@1": { required: ["schema", "bookingId", "reason"], optional: [] },
    "pibu/input-request@1": { required: ["schema", "fields"], optional: [] },
    "pibu/input-response@1": { required: ["schema", "values"], optional: [] },
    "pibu/outcome@1": {
      required: [
        "schema", "outcomeId", "bookingId", "clinicId", "procedureId", "checkpoint", "paidKrw", "receivedAmount",
        "productVerified", "receiptAttached", "satisfaction", "painScore", "downtimeDaysActual", "wouldReturn",
        "sideEffects", "visitorProfile", "submittedAt",
      ],
      optional: ["comment"],
    },
    "pibu/signal-report@1": { required: ["schema", "clinicId", "kind", "requestId", "at"], optional: ["taskId"] },
    "pibu/checkin-request@1": { required: ["schema", "bookingId", "checkpoint", "questions"], optional: [] },
    "pibu/notification@1": { required: ["schema", "kind", "text"], optional: ["bookingId"] },
    "pibu/recipe-query@1": { required: ["schema", "concerns", "ageBand"], optional: ["procedureIds"] },
    "pibu/recipe@1": { required: ["schema", "combinations", "procedures", "disclaimer"], optional: [] },
    "pibu/offers-query@1": { required: ["schema"], optional: ["month"] },
    "pibu/offers@1": { required: ["schema", "clinicId", "month", "items"], optional: [] },
    "pibu/availability-query@1": { required: ["schema", "procedureId", "from", "to"], optional: [] },
    "pibu/availability@1": { required: ["schema", "clinicId", "slots", "indicative"], optional: [] },
  };

  it("declares exactly the documented fields, no more and no fewer", () => {
    for (const name of Object.keys(PIBU_SCHEMAS) as PibuSchemaName[]) {
      const shape = (PIBU_SCHEMAS[name] as unknown as { shape: Record<string, unknown> }).shape;
      const documented = [...FIELDS[name].required, ...FIELDS[name].optional].sort();
      expect(Object.keys(shape).sort(), name).toEqual(documented);
    }
  });

  it("fails when any single required field is removed and still passes without an optional one", () => {
    let required = 0;
    let optional = 0;
    for (const f of wireFixtures) {
      const schema = PIBU_SCHEMAS[f.name];
      for (const key of FIELDS[f.name].required) {
        const variant = clone(f.data);
        expect(key in variant, `${f.name} fixture lacks ${key}`).toBe(true);
        delete variant[key];
        expect(schema.safeParse(variant).success, `${f.name} without ${key}`).toBe(false);
        required += 1;
      }
      for (const key of FIELDS[f.name].optional) {
        if (!(key in f.data)) continue;
        const variant = clone(f.data);
        delete variant[key];
        expect(schema.safeParse(variant).success, `${f.name} without optional ${key}`).toBe(true);
        optional += 1;
      }
    }
    expect(required).toBeGreaterThan(100);
    expect(optional).toBeGreaterThan(5);
  });

  it("rejects unknown fields (strict objects), at the top level and nested", () => {
    const quote = fixture("pibu/quote@1", "direct clinic quote without event") as Record<string, unknown>;
    expect(PIBU_SCHEMAS["pibu/quote@1"].safeParse({ ...quote, discount: 10 }).success).toBe(false);
    expect(PIBU_SCHEMAS["pibu/quote@1"].safeParse({ ...quote, amount: { value: 2, unit: "cc", extra: 1 } }).success).toBe(false);
  });
});

describe("field rules", () => {
  it("requires every event field, in quotes and in offers", () => {
    for (const key of ["title", "regularPriceKrw", "validFrom", "validUntil", "conditions"]) {
      const quote = fixture("pibu/quote@1", "proxy clinic quote with event") as { event: Record<string, unknown> };
      delete quote.event[key];
      expect(PIBU_SCHEMAS["pibu/quote@1"].safeParse(quote).success, `quote event without ${key}`).toBe(false);

      const offers = fixture("pibu/offers@1") as { items: Array<{ event?: Record<string, unknown> }> };
      delete offers.items[0]!.event![key];
      expect(PIBU_SCHEMAS["pibu/offers@1"].safeParse(offers).success, `offers event without ${key}`).toBe(false);
    }
  });

  it("enforces formats: ids, whole won, offset datetimes, ordered date ranges, ISO country codes", () => {
    const quote = fixture("pibu/quote@1", "direct clinic quote without event") as Record<string, unknown>;
    const parse = (patch: Record<string, unknown>) => PIBU_SCHEMAS["pibu/quote@1"].safeParse({ ...quote, ...patch }).success;
    expect(parse({})).toBe(true);
    expect(parse({ clinicId: "seoul-glow" })).toBe(false);
    expect(parse({ quoteId: "cln_mint" })).toBe(false);
    expect(parse({ priceKrw: 340000.5 })).toBe(false);
    expect(parse({ priceKrw: -1 })).toBe(false);
    expect(parse({ slots: ["2026-11-14T11:00:00"] })).toBe(false);
    expect(parse({ validUntil: "2026-13-01" })).toBe(false);

    const request = fullRequest() as Record<string, unknown>;
    const schema = PIBU_SCHEMAS["pibu/procedure-request@1"];
    expect(schema.safeParse({ ...request, dateWindow: { from: "2026-11-15", to: "2026-11-13" } }).success).toBe(false);
    expect(schema.safeParse({ ...request, languages: [] }).success).toBe(false);
    expect(
      schema.safeParse({ ...request, visitorProfile: { nationality: "Japan" } }).success,
    ).toBe(false);
  });

  it("caps a shortlist at five candidates and a verdict list label set", () => {
    const shortlist = fixture("pibu/clinic-shortlist@1") as { candidates: unknown[] };
    const candidate = shortlist.candidates[0];
    shortlist.candidates = [candidate, candidate, candidate, candidate, candidate];
    expect(PIBU_SCHEMAS["pibu/clinic-shortlist@1"].safeParse(shortlist).success).toBe(true);
    shortlist.candidates.push(candidate);
    expect(PIBU_SCHEMAS["pibu/clinic-shortlist@1"].safeParse(shortlist).success).toBe(false);
  });
});

describe("parsePibuData routing", () => {
  it("routes every skill to its documented input schema", () => {
    expect(SKILL_IDS.sort()).toEqual(
      [
        "customer.checkin",
        "customer.notify",
        "clinic.availability",
        "clinic.book",
        "clinic.cancel",
        "clinic.offers",
        "clinic.quote",
        "platform.judge_quote",
        "platform.match_clinics",
        "platform.recipe",
        "platform.report_booking",
        "platform.report_signal",
        "platform.submit_outcome",
      ].sort(),
    );
    for (const id of SKILL_IDS) {
      const route = SKILL_ROUTES[id];
      const literal = (route.schema as unknown as { shape: { schema: { value: string } } }).shape.schema.value;
      expect(literal, id).toBe(route.input);
    }
  });

  it("accepts a valid request for each skill whose fixture is the documented input", () => {
    const inputs: Array<[keyof typeof SKILL_ROUTES, Record<string, unknown>]> = [
      ["platform.recipe", fixture("pibu/recipe-query@1")],
      ["platform.match_clinics", fullRequest()],
      ["platform.judge_quote", fixture("pibu/judge-request@1")],
      ["platform.report_booking", fixture("pibu/booking@1")],
      ["platform.submit_outcome", fixture("pibu/outcome@1")],
      ["platform.report_signal", fixture("pibu/signal-report@1")],
      ["clinic.offers", fixture("pibu/offers-query@1")],
      ["clinic.quote", clinicCopy()],
      ["clinic.availability", fixture("pibu/availability-query@1")],
      ["clinic.book", fixture("pibu/booking-request@1")],
      ["clinic.cancel", fixture("pibu/cancel-request@1")],
      ["customer.notify", fixture("pibu/notification@1")],
      ["customer.checkin", fixture("pibu/checkin-request@1")],
    ];
    expect(inputs).toHaveLength(SKILL_IDS.length);
    for (const [skillId, data] of inputs) {
      const result = parsePibuData(skillId, data);
      expect(result.ok, `${skillId}: ${JSON.stringify(!result.ok && result.error)}`).toBe(true);
    }
  });

  it("rejects an unknown skill, a missing schema name, a non-object and a skill and schema mismatch with -32602", () => {
    const cases: unknown[] = [
      parsePibuData("platform.nope", fullRequest()),
      parsePibuData(undefined, fullRequest()),
      parsePibuData("clinic.book", { requestId: "req_1" }),
      parsePibuData("clinic.book", "text"),
      parsePibuData("clinic.book", [fullRequest()]),
      parsePibuData("clinic.book", fullRequest()),
      parsePibuData("platform.recipe", fixture("pibu/booking-request@1")),
    ];
    for (const result of cases) {
      expect(result).toMatchObject({ ok: false, error: { code: INVALID_PARAMS } });
    }
  });

  it("reports the failing field path in the error data", () => {
    const bad = fixture("pibu/booking-request@1") as { guest: Record<string, unknown> };
    delete bad.guest.contactHandle;
    const result = parsePibuData("clinic.book", bad);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.data.issues.map((i) => i.path)).toContain("guest.contactHandle");
  });

  describe("recipient specific procedure request rules", () => {
    it("the platform needs residency and ageBand, the full request passes", () => {
      expect(parsePibuData("platform.match_clinics", fullRequest()).ok).toBe(true);

      const noResidency = fullRequest() as { visitorProfile: Record<string, unknown> };
      delete noResidency.visitorProfile.residency;
      const result = parsePibuData("platform.match_clinics", noResidency);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.data.issues.map((i) => i.path)).toEqual(["visitorProfile.residency"]);

      const noAge = fullRequest() as { visitorProfile: Record<string, unknown> };
      delete noAge.visitorProfile.ageBand;
      expect(parsePibuData("platform.match_clinics", noAge).ok).toBe(false);
    });

    it("a clinic accepts only the minimal copy and rejects each extra field", () => {
      expect(parsePibuData("clinic.quote", clinicCopy()).ok).toBe(true);
      expect(parsePibuData("clinic.quote", fullRequest()).ok).toBe(false);

      const extras: Array<[string, (r: ReturnType<typeof clinicCopy>) => void]> = [
        ["notes", (r) => ((r as Record<string, unknown>).notes = "free text")],
        ["budgetKrw", (r) => ((r as Record<string, unknown>).budgetKrw = { max: 450000 })],
        ["visitorProfile.residency", (r) => (r.visitorProfile.residency = "short_term_visitor")],
        ["visitorProfile.ageBand", (r) => (r.visitorProfile.ageBand = "25-29")],
      ];
      for (const [path, add] of extras) {
        const request = clinicCopy();
        add(request);
        const result = parsePibuData("clinic.quote", request);
        expect(result.ok, path).toBe(false);
        if (!result.ok) expect(result.error.data.issues.map((i) => i.path), path).toEqual([path]);
      }
    });
  });

  describe("input-response exception", () => {
    const response = () => fixture("pibu/input-response@1");

    it("is accepted for any skill only while the task waits for input", () => {
      const result = parsePibuData("clinic.book", response(), { state: "TASK_STATE_INPUT_REQUIRED" });
      expect(result).toMatchObject({ ok: true, kind: "input_response", skillId: "clinic.book" });
    });

    it("is rejected without a task or when the task is in another state", () => {
      expect(parsePibuData("clinic.book", response())).toMatchObject({ ok: false, error: { code: INVALID_PARAMS } });
      for (const state of ["TASK_STATE_WORKING", "TASK_STATE_COMPLETED", "TASK_STATE_SUBMITTED"]) {
        expect(parsePibuData("clinic.book", response(), { state }).ok, state).toBe(false);
      }
    });

    it("must be what a task in INPUT_REQUIRED receives, other schemas are rejected", () => {
      const result = parsePibuData("clinic.book", fixture("pibu/booking-request@1"), { state: "TASK_STATE_INPUT_REQUIRED" });
      expect(result).toMatchObject({ ok: false, error: { code: INVALID_PARAMS } });
    });

    it("still validates the response body", () => {
      const result = parsePibuData("clinic.book", { schema: "pibu/input-response@1", values: { a: 1 } }, { state: "TASK_STATE_INPUT_REQUIRED" });
      expect(result.ok).toBe(false);
    });
  });
});
