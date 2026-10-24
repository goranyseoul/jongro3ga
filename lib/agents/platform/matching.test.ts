import { describe, expect, it } from "vitest";
import clinicsSeed from "../../../data/seed/clinics.json";
import outcomesSeed from "../../../data/seed/outcomes.json";
import recordsSeed from "../../../data/seed/price-records.json";
import rulesSeed from "../../../data/seed/rules.json";
import type { OffersV1, ProcedureRequestV1 } from "../../a2a/schemas";
import type { ClinicRegistryEntry, Outcome, PriceRecord, RoutingRule } from "../../domain";
import { checkEligibility } from "./eligibility";
import { hardFilter, matchClinics, nearestItem, scoreClinic, type MatchClinicInput } from "./matching";
import { applicableRules, ruleMatches } from "./rules";

const records = recordsSeed as unknown as PriceRecord[];
const outcomes = outcomesSeed as unknown as Outcome[];
const seedRules = rulesSeed as unknown as RoutingRule[];
const NOW = "2026-10-24T10:00:00+09:00";
const TODAY = "2026-10-24";

/** What a clinic.offers answer looks like for a seed clinic (menu + events valid today). */
function seedInputs(): MatchClinicInput[] {
  return (clinicsSeed as unknown as Array<{ registry: ClinicRegistryEntry; menu: Array<Record<string, unknown>>; offers: Array<Record<string, unknown>> }>).map(
    (c) => ({
      registry: c.registry,
      offers: {
        schema: "pibu/offers@1",
        clinicId: c.registry.id,
        month: "2026-10",
        items: [
          ...c.menu.map((m) => ({ procedureId: m.procedureId, product: m.product, amount: m.amount, priceKrw: m.priceKrw, vatIncluded: m.vatIncluded })),
          ...c.offers.map((o) => ({
            procedureId: o.procedureId,
            product: o.title,
            amount: o.amount,
            priceKrw: o.priceKrw,
            vatIncluded: true,
            event: { title: o.title, regularPriceKrw: o.regularPriceKrw, validFrom: o.validFrom, validUntil: o.validUntil, conditions: o.conditions },
          })),
        ],
      } as OffersV1,
      outcomes: outcomes.filter((o) => o.clinicId === c.registry.id),
      timeouts: 0,
      quoteRequests: 0,
    }),
  );
}

const yuki: ProcedureRequestV1 = {
  schema: "pibu/procedure-request@1",
  requestId: "req_yuki01",
  customerAgentId: "cag_7f3k2",
  procedureId: "rejuran",
  amount: { value: 2, unit: "cc" },
  budgetKrw: { max: 450000 },
  areas: ["sinsa", "gangnam", "apgujeong"],
  languages: ["ja"],
  dateWindow: { from: "2026-11-08", to: "2026-11-10" },
  visitorProfile: { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true },
};

const run = (request: ProcedureRequestV1, clinics = seedInputs(), rules: RoutingRule[] = seedRules) =>
  matchClinics({ request, clinics, records, rules, today: TODAY, nowIso: NOW });

const rule = (id: string, then: RoutingRule["then"], when: RoutingRule["when"] = {}): RoutingRule => ({
  id,
  version: 1,
  status: "active",
  when,
  then,
  reason: "test",
  evidence: { outcomeIds: [], signalIds: [], summary: "test" },
  source: "operator",
  createdAt: NOW,
  appliedCount: 0,
});

describe("Yuki's rejuran request (seed)", () => {
  it("returns Seoul Glow, Mint and Ara with no applied rules", () => {
    const result = run(yuki);
    expect(result.candidates.map((c) => c.clinicId)).toEqual(["cln_seoul_glow", "cln_mint", "cln_ara"]);
    expect(result.appliedRuleIds).toEqual([]);
    expect(result.filtered).toEqual([
      { clinicId: "cln_dahye", reason: "language" },
      { clinicId: "cln_hanbit", reason: "area" },
    ]);
    expect(result.priceReference).toMatchObject({ region: "gangnam_sinsa", p25UnitKrw: 140000, p50UnitKrw: 160000, p75UnitKrw: 185000, sampleSize: 42, windowDays: 120, unit: "cc" });
    for (const c of result.candidates) {
      expect(c.score).toBeGreaterThan(0);
      expect(c.score).toBeLessThanOrEqual(1);
      expect(c.reasons.length).toBeGreaterThanOrEqual(2);
    }
    expect(result.candidates[0].reasons).toContain("Japanese-speaking staff on site");
    expect(result.candidates[1].reasons).toContain("Japanese interpreter available");
  });

  it("is deterministic: same input, same output", () => {
    expect(run(yuki)).toEqual(run(yuki));
    expect(run(yuki, seedInputs().reverse())).toEqual(run(yuki));
  });

  it("caps Mint's price factor at 0.3 because it only sells 1cc (below the typical 2cc)", () => {
    const mint = seedInputs().find((c) => c.registry.id === "cln_mint")!;
    const s = scoreClinic(yuki, mint, { n: 42, p25: 140000, p75: 185000, typicalAmount: { min: 2, max: 3, unit: "cc" } });
    expect(s.factors.price).toBe(0.3);
  });
});

describe("hard filters", () => {
  const glow = () => seedInputs().find((c) => c.registry.id === "cln_seoul_glow")!;

  it("drops unverified, unregistered, procedure-less, language-less and out-of-area clinics", () => {
    expect(hardFilter(yuki, glow())).toEqual({ ok: true });
    expect(hardFilter(yuki, { ...glow(), registry: { ...glow().registry, verificationStatus: "suspended" } })).toEqual({ ok: false, reason: "not_verified" });
    expect(hardFilter(yuki, { ...glow(), registry: { ...glow().registry, foreignPatientFacilityRegistered: false } })).toEqual({ ok: false, reason: "not_verified" });
    expect(hardFilter({ ...yuki, procedureId: "ulthera" }, glow())).toEqual({ ok: false, reason: "procedure_not_offered" });
    expect(hardFilter(yuki, { ...glow(), offers: undefined })).toEqual({ ok: false, reason: "procedure_not_offered" });
    expect(hardFilter({ ...yuki, languages: ["zh-CN"] }, glow())).toEqual({ ok: false, reason: "language" });
    expect(hardFilter({ ...yuki, areas: ["hongdae"] }, glow())).toEqual({ ok: false, reason: "area" });
  });

  it("app_translation alone fails the language filter unless the request is Korean", () => {
    const dahye = seedInputs().find((c) => c.registry.id === "cln_dahye")!;
    expect(hardFilter({ ...yuki, areas: [] }, dahye)).toEqual({ ok: false, reason: "language" });
    expect(hardFilter({ ...yuki, areas: [], languages: ["ko"] }, dahye)).toEqual({ ok: true });
  });

  it("same area group passes the area filter", () => {
    expect(hardFilter({ ...yuki, areas: ["gangnam"] }, glow())).toEqual({ ok: true });
  });
});

describe("ordering, rules, budget", () => {
  function twins(): MatchClinicInput[] {
    const base = seedInputs().find((c) => c.registry.id === "cln_seoul_glow")!;
    const clone = (id: string): MatchClinicInput => ({
      ...base,
      registry: { ...base.registry, id, slug: id },
      offers: { ...base.offers!, clinicId: id },
    });
    return [clone("cln_zeta"), clone("cln_alpha"), clone("cln_mid")];
  }

  it("breaks score ties by clinicId", () => {
    const result = run(yuki, twins(), []);
    expect(new Set(result.candidates.map((c) => c.score)).size).toBe(1);
    expect(result.candidates.map((c) => c.clinicId)).toEqual(["cln_alpha", "cln_mid", "cln_zeta"]);
  });

  it("applies require_language, then exclude_clinic, then adjustments, whatever the rule ids", () => {
    const rules = [
      rule("rule_a", { kind: "boost_clinic", clinicIds: ["cln_ara", "cln_mint"], delta: 0.3 }),
      rule("rule_b", { kind: "exclude_clinic", clinicIds: ["cln_mint"] }),
      rule("rule_c", { kind: "require_language", languages: ["ja"] }),
      rule("rule_d", { kind: "demote_clinic", clinicIds: ["cln_seoul_glow"], delta: 0.3 }),
    ];
    expect(applicableRules(rules, yuki, NOW).map((r) => r.id)).toEqual(["rule_c", "rule_b", "rule_a", "rule_d"]);
    const result = run(yuki, seedInputs(), rules);
    expect(result.appliedRuleIds).toEqual(["rule_c", "rule_b", "rule_a", "rule_d"]);
    expect(result.candidates.map((c) => c.clinicId)).toEqual(["cln_ara", "cln_seoul_glow"]);
    expect(result.candidates[0].reasons).toContain("Visitors with similar requests were satisfied here");
    expect(result.candidatesBeforeRules.map((c) => c.clinicId)).toEqual(["cln_seoul_glow", "cln_mint", "cln_ara"]);
    for (const c of result.candidates) expect(c.reasons.join(" ")).not.toMatch(/rule|exclude|demote/i);
  });

  it("require_language narrows to clinics with staff or interpreter for that language", () => {
    const result = run({ ...yuki, languages: ["ja", "en"] }, seedInputs(), [rule("rule_x", { kind: "require_language", languages: ["en"] })]);
    expect(result.candidates.map((c) => c.clinicId).sort()).toEqual(["cln_ara", "cln_mint", "cln_seoul_glow"]);
    const zh = run({ ...yuki, languages: ["ja", "zh-CN"] }, seedInputs(), [rule("rule_y", { kind: "require_language", languages: ["zh-CN"] })]);
    expect(zh.candidates).toEqual([]);
  });

  it("an excluded or demoted clinic stays clamped to 0..1, boosts clamp at 1", () => {
    const result = run(yuki, seedInputs(), [rule("rule_up", { kind: "boost_clinic", clinicIds: ["cln_seoul_glow"], delta: 0.3 })]);
    expect(result.candidates[0]).toMatchObject({ clinicId: "cln_seoul_glow", score: 1 });
  });

  it("subtracts 0.1 and says so when the menu total exceeds budget x 1.1", () => {
    const tight = run({ ...yuki, budgetKrw: { max: 300000 } }, seedInputs(), []);
    const normal = run(yuki, seedInputs(), []);
    const glow = (r: typeof tight) => r.candidates.find((c) => c.clinicId === "cln_seoul_glow")!;
    expect(glow(normal).score - glow(tight).score).toBeCloseTo(0.1, 2);
    expect(glow(tight).reasons).toContain("May exceed your budget");
    expect(glow(normal).reasons).not.toContain("May exceed your budget");
  });

  it("seed rules match CN and ulthera requests only", () => {
    expect(seedRules.map((r) => ruleMatches(r.when, yuki))).toEqual([false, false]);
    expect(ruleMatches(seedRules[0].when, { ...yuki, visitorProfile: { ...yuki.visitorProfile, nationality: "CN" } })).toBe(true);
    expect(ruleMatches(seedRules[1].when, { ...yuki, procedureId: "ulthera" })).toBe(true);
  });

  it("ignores inactive and expired rules", () => {
    const expired = { ...rule("rule_old", { kind: "exclude_clinic", clinicIds: ["cln_ara"] }), expiresAt: "2026-10-01T00:00:00+09:00" };
    const proposed = { ...rule("rule_new", { kind: "exclude_clinic", clinicIds: ["cln_ara"] }), status: "proposed" as const };
    expect(run(yuki, seedInputs(), [expired, proposed]).appliedRuleIds).toEqual([]);
  });

  it("picks the menu item nearest the requested amount, larger on ties", () => {
    const item = (value: number) => ({ procedureId: "rejuran", product: "x", amount: { value, unit: "cc" as const }, priceKrw: 1, vatIncluded: true });
    expect(nearestItem([item(1), item(3)], 2)?.amount.value).toBe(3);
    expect(nearestItem([item(1), item(2), item(4)], 2)?.amount.value).toBe(2);
  });
});

describe("eligibility", () => {
  it("rejects Korean nationals and residents, accepts short-term visitors", () => {
    expect(checkEligibility({ nationality: "KR" })).toMatchObject({ eligible: false, reason: "not_eligible_foreign_patient" });
    expect(checkEligibility({ nationality: "JP", residency: "resident" })).toMatchObject({ eligible: false, reason: "not_eligible_foreign_patient" });
    expect(checkEligibility({ nationality: "JP", residency: "short_term_visitor" })).toEqual({ eligible: true });
  });
});
