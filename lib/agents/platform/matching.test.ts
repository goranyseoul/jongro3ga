import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { verifyReferralToken } from "../../a2a/auth";
import { PIBU_SCHEMAS } from "../../a2a/schemas";
import { clock } from "../../clock";
import type { ClinicRegistryEntry, RoutingRule } from "../../domain";
import { setupPlatformTest, seedOffers, teardownPlatformTest } from "./__fixtures__/offer-cache";
import { YUKI_AGENT, yukiRequest } from "./__fixtures__/requests";
import { hasBannedComparison } from "./copy-common";
import { hardFilter, matchClinics, nearestItem, rankClinics, type MatchInputs } from "./matching";
import { activateRule, applyRules, ruleMatches } from "./rules";
import { platformStore } from "./store";

beforeEach(setupPlatformTest);
afterEach(teardownPlatformTest);

async function inputs(extra: Partial<MatchInputs> = {}): Promise<MatchInputs> {
  return {
    request: yukiRequest(),
    registry: await platformStore.registry(),
    offers: seedOffers(),
    priceRecords: await platformStore.priceRecords(),
    outcomes: await platformStore.outcomes(),
    signals: await platformStore.signals(),
    referrals: {},
    rules: await platformStore.rules(),
    now: clock.now(),
    ...extra,
  };
}

const rule = (id: string, when: RoutingRule["when"], then: RoutingRule["then"], extra: Partial<RoutingRule> = {}): RoutingRule => ({
  id,
  version: 1,
  status: "active",
  when,
  then,
  reason: "test",
  evidence: { outcomeIds: [], signalIds: [], summary: "test" },
  source: "operator",
  createdAt: "2026-11-01T10:00:00+09:00",
  appliedCount: 0,
  ...extra,
});

const ids = (list: { clinic: { id: string } }[]) => list.map((c) => c.clinic.id);

describe("hard filters", () => {
  const offersOf = (clinicId: string) => seedOffers().find((o) => o.clinicId === clinicId);
  const clinic = async (id: string) => (await platformStore.clinic(id)) as ClinicRegistryEntry;

  it("1: only verified clinics registered as foreign patient facilities", async () => {
    const sg = await clinic("cln_seoul_glow");
    expect(hardFilter(sg, offersOf(sg.id), yukiRequest()).pass).toBe(true);
    expect(hardFilter({ ...sg, verificationStatus: "suspended" }, offersOf(sg.id), yukiRequest())).toEqual({ pass: false, reason: "not_verified" });
    expect(hardFilter({ ...sg, foreignPatientFacilityRegistered: false }, offersOf(sg.id), yukiRequest())).toEqual({ pass: false, reason: "not_verified" });
  });

  it("2: the requested procedure must be on the cached menu or offers (Mint passes with its 1cc event only)", async () => {
    const mint = await clinic("cln_mint");
    expect(hardFilter(mint, offersOf("cln_mint"), yukiRequest()).pass).toBe(true);
    expect(hardFilter(mint, offersOf("cln_mint"), yukiRequest({ procedureId: "ulthera" }))).toEqual({ pass: false, reason: "no_procedure" });
    expect(hardFilter(mint, undefined, yukiRequest())).toEqual({ pass: false, reason: "no_procedure" });
  });

  it("3: a requested language with staff or interpreter, app translation is not enough, Korean requests skip it", async () => {
    const hanbit = await clinic("cln_hanbit");
    expect(hardFilter(hanbit, offersOf("cln_hanbit"), yukiRequest())).toEqual({ pass: false, reason: "language" });
    const translated = { ...hanbit, languages: [{ locale: "ja" as const, mode: "app_translation" as const }] };
    expect(hardFilter(translated, offersOf("cln_hanbit"), yukiRequest())).toEqual({ pass: false, reason: "language" });
    expect(hardFilter(translated, offersOf("cln_hanbit"), yukiRequest({ languages: ["ko"] })).pass).toBe(true);
  });
});

describe("nearest menu item", () => {
  const item = (value: number, priceKrw: number, zk = false) => ({
    procedureId: "rejuran_healer",
    product: "Rejuran Healer",
    amount: { value, unit: "cc" as const },
    priceKrw,
    vatIncluded: true,
    ...(zk ? { event: { title: "t", regularPriceKrw: priceKrw, validFrom: "2026-11-01", validUntil: "2026-11-30", conditions: "c", zkClauses: [{ maxCount: 0 }] } } : {}),
  });

  it("picks the amount closest to the request, then a non-proof item, then the larger amount", () => {
    expect(nearestItem([item(1, 99_000), item(3, 450_000), item(2, 340_000)], 2).amount.value).toBe(2);
    expect(nearestItem([item(2, 306_000, true), item(2, 340_000)], 2).priceKrw).toBe(340_000);
    expect(nearestItem([item(1, 150_000), item(3, 450_000)], 2).amount.value).toBe(3);
  });
});

describe("scores", () => {
  it("are deterministic: the same inputs give the same scores and order", async () => {
    const a = rankClinics(await inputs());
    const b = rankClinics(await inputs());
    expect(a.ranked.map((c) => [c.clinic.id, c.score])).toEqual(b.ranked.map((c) => [c.clinic.id, c.score]));
    expect(a.candidatesBeforeRules.map((c) => c.factors)).toEqual(b.candidatesBeforeRules.map((c) => c.factors));
  });

  it("follow the 07 table for Yuki: Seoul Glow, Mint (price capped at 0.3 for its 1cc event), Ara", async () => {
    const { ranked } = rankClinics(await inputs());
    expect(ids(ranked)).toEqual(["cln_seoul_glow", "cln_mint", "cln_ara"]);
    const [sg, mint, ara] = ranked;
    expect(sg.factors.fit).toBe(1);
    expect(mint.factors.fit).toBe(0.6);
    expect(sg.factors.price).toBeCloseTo((185_000 - 170_000) / 45_000, 6);
    expect(mint.factors.price).toBe(0.3);
    expect(ara.factors.price).toBeCloseTo((185_000 - 165_000) / 45_000, 6);
    // Seoul Glow: 8 outcomes, satisfaction sum 36, gaps 0
    expect(sg.factors.outcome).toBeCloseTo(((5 * 4 + 36) / 13 - 1) / 4, 6);
    expect(sg.factors.reliability).toBe(1);
    // Ara: 90 day gaps 0.12, 0.14, 0.16, 0.18 -> 1 - 0.15 x 2
    expect(ara.factors.reliability).toBeCloseTo(0.7, 6);
    expect(sg.score).toBeCloseTo(0.35 + 0.25 * sg.factors.price + 0.25 * sg.factors.outcome + 0.15, 4);
  });

  it("break ties by clinicId", async () => {
    const registry = await platformStore.registry();
    const ara = registry.find((c) => c.id === "cln_ara")!;
    const twin = { ...ara, id: "cln_aaa", slug: "aaa" };
    const offers = [...seedOffers(), { ...seedOffers().find((o) => o.clinicId === "cln_ara")!, clinicId: "cln_aaa" }];
    const outcomes = (await platformStore.outcomes()).flatMap((o) => (o.clinicId === "cln_ara" ? [o, { ...o, id: `${o.id}_twin`, clinicId: "cln_aaa" }] : [o]));
    const { candidatesBeforeRules } = rankClinics(await inputs({ registry: [twin, ...registry], offers, outcomes }));
    const pair = candidatesBeforeRules.filter((c) => c.clinic.id === "cln_aaa" || c.clinic.id === "cln_ara");
    expect(pair[0].score).toBe(pair[1].score);
    expect(ids(pair)).toEqual(["cln_aaa", "cln_ara"]);
  });

  it("take 0.1 off when the menu total exceeds the budget by more than 10%", async () => {
    const free = rankClinics(await inputs({ request: yukiRequest({ budgetKrw: undefined }) })).candidatesBeforeRules;
    const tight = rankClinics(await inputs({ request: yukiRequest({ budgetKrw: { max: 300_000 } }) })).candidatesBeforeRules;
    const at = (list: typeof free, id: string) => list.find((c) => c.clinic.id === id)!;
    // Seoul Glow 340,000 > 330,000: penalized. Ara 330,000 is not above 330,000.
    expect(at(tight, "cln_seoul_glow").budgetExceeded).toBe(true);
    expect(at(tight, "cln_seoul_glow").score).toBeCloseTo(at(free, "cln_seoul_glow").score - 0.1, 4);
    expect(at(tight, "cln_ara").budgetExceeded).toBe(false);
    expect(at(tight, "cln_ara").score).toBe(at(free, "cln_ara").score);
  });

  it("keep at most three candidates", async () => {
    const all = rankClinics(await inputs({ request: yukiRequest({ languages: ["ko"] }) }));
    expect(all.candidatesBeforeRules).toHaveLength(5);
    expect(all.ranked).toHaveLength(3);
  });

  it("count response timeouts against referrals", async () => {
    const at = clock.nowIso();
    const signals = [1, 2].map((i) => ({ id: `sig_t${i}`, clinicId: "cln_mint", kind: "response_timeout" as const, value: 1, context: {}, at }));
    const { candidatesBeforeRules } = rankClinics(await inputs({ signals, referrals: { cln_mint: 4 } }));
    const mint = candidatesBeforeRules.find((c) => c.clinic.id === "cln_mint")!;
    expect(mint.details.timeoutRatio).toBe(0.5);
  });
});

describe("rules", () => {
  const candidates = async () => rankClinics(await inputs({ request: yukiRequest({ languages: ["ja", "zh-CN"] }), rules: [] })).candidatesBeforeRules;

  it("match on every set field of `when`, unset fields are wildcards", () => {
    const req = yukiRequest();
    expect(ruleMatches({}, req)).toBe(true);
    expect(ruleMatches({ nationalities: ["JP"], procedureIds: ["rejuran_healer"] }, req)).toBe(true);
    expect(ruleMatches({ nationalities: ["JP"], procedureIds: ["ulthera"] }, req)).toBe(false);
    expect(ruleMatches({ areas: ["myeongdong"] }, req)).toBe(false);
    expect(ruleMatches({ budgetMaxBelowKrw: 500_000 }, req)).toBe(true);
    expect(ruleMatches({ budgetMaxBelowKrw: 450_000 }, req)).toBe(false);
    expect(ruleMatches({ ageBands: ["30-34"] }, req)).toBe(false);
    expect(ruleMatches({ firstKProcedure: true }, req)).toBe(true);
  });

  it("apply require_language, then exclude_clinic, then boost / demote / prefer_area, whatever the id order", async () => {
    const before = await candidates();
    expect(ids(before)).toContain("cln_hanbit");
    const rules = [
      rule("rule_a_boost", {}, { kind: "boost_clinic", clinicIds: ["cln_hanbit", "cln_ara"], delta: 0.3 }),
      rule("rule_b_exclude", {}, { kind: "exclude_clinic", clinicIds: ["cln_mint"] }),
      rule("rule_c_lang", {}, { kind: "require_language", languages: ["ja"] }),
      rule("rule_d_area", {}, { kind: "prefer_area", areas: ["sinsa"], delta: 0.3 }),
      rule("rule_e_demote", {}, { kind: "demote_clinic", clinicIds: ["cln_ara"], delta: 0.05 }),
    ];
    const applied = applyRules(before, rules, yukiRequest(), clock.now());
    expect(applied.appliedRuleIds).toEqual(["rule_c_lang", "rule_b_exclude", "rule_a_boost", "rule_d_area", "rule_e_demote"]);
    // Hanbit (no Japanese) is gone before the boost could lift it; Mint is excluded.
    expect(ids(applied.candidates).sort()).toEqual(["cln_ara", "cln_seoul_glow"]);
    const score = (list: { clinic: { id: string }; score: number }[], id: string) => list.find((c) => c.clinic.id === id)!.score;
    expect(score(applied.candidates, "cln_seoul_glow")).toBe(1); // clamped
    expect(score(applied.candidates, "cln_ara")).toBeCloseTo(score(before, "cln_ara") + 0.3 - 0.05, 6);
    expect(applied.candidates.find((c) => c.clinic.id === "cln_ara")!.ruleEffects).toEqual(["boost", "demote"]);
  });

  it("clamp boosted and demoted scores to 0..1", async () => {
    const before = await candidates();
    const rules = [
      rule("rule_up", {}, { kind: "boost_clinic", clinicIds: ["cln_seoul_glow"], delta: 0.3 }),
      rule("rule_up2", {}, { kind: "boost_clinic", clinicIds: ["cln_seoul_glow"], delta: 0.3 }),
      ...[1, 2, 3, 4].map((i) => rule(`rule_down${i}`, {}, { kind: "demote_clinic", clinicIds: ["cln_mint"], delta: 0.3 })),
    ];
    const applied = applyRules(before, rules, yukiRequest(), clock.now());
    expect(applied.candidates.find((c) => c.clinic.id === "cln_seoul_glow")!.score).toBe(1);
    expect(applied.candidates.find((c) => c.clinic.id === "cln_mint")!.score).toBe(0);
  });

  it("skip rules that are not active, expired or do not match the request", async () => {
    const before = await candidates();
    const exclude = { kind: "exclude_clinic" as const, clinicIds: ["cln_ara"] };
    const rules = [
      rule("rule_p", {}, exclude, { status: "proposed" }),
      rule("rule_x", {}, exclude, { expiresAt: "2026-11-12T09:59:59+09:00" }),
      rule("rule_cn", { nationalities: ["CN"] }, exclude),
    ];
    const applied = applyRules(before, rules, yukiRequest(), clock.now());
    expect(applied.appliedRuleIds).toEqual([]);
    expect(ids(applied.candidates)).toContain("cln_ara");
  });
});

describe("matchClinics (Yuki, cus_yuki_done)", () => {
  it("shortlists Seoul Glow, Mint and Ara with no rule applied and signed referral tokens", async () => {
    const result = await matchClinics(yukiRequest(), YUKI_AGENT);
    if (result.state !== "completed") throw new Error(result.reason);
    const { shortlist } = result;
    expect(PIBU_SCHEMAS["pibu/clinic-shortlist@1"].safeParse(shortlist).success).toBe(true);
    expect(shortlist.appliedRuleIds).toEqual([]);
    expect(shortlist.candidates.map((c) => c.clinicId)).toEqual(["cln_seoul_glow", "cln_mint", "cln_ara"]);
    expect(shortlist.priceReference).toEqual({
      procedureId: "rejuran_healer",
      unit: "cc",
      region: "gangnam_sinsa",
      p25UnitKrw: 140_000,
      p50UnitKrw: 160_000,
      p75UnitKrw: 185_000,
      sampleSize: 42,
      windowDays: 120,
    });
    for (const c of shortlist.candidates) {
      const claims = await verifyReferralToken(c.referralToken, { clinicId: c.clinicId });
      if ("error" in claims) throw new Error(claims.error);
      expect(claims).toMatchObject({ aud: c.clinicId, sub: YUKI_AGENT, rid: "req_yuki_t1", mid: shortlist.matchId });
      expect("error" in (await verifyReferralToken(c.referralToken, { clinicId: "cln_hanbit" }))).toBe(true);
      expect(c.agentCardUrl).toMatch(/^https:\/\/pibu\.example\/a2a\/clinics\/[a-z-]+\/agent-card\.json$/);
    }
    const logs = await platformStore.matchLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ id: shortlist.matchId, customerAgentId: YUKI_AGENT, appliedRuleIds: [] });
    expect(logs[0].candidatesBeforeRules.map((c) => c.clinicId)).toEqual(["cln_seoul_glow", "cln_mint", "cln_ara"]);
  });

  it("writes reasons in the request language: top two factors, location, no clinic comparison", async () => {
    const result = await matchClinics(yukiRequest(), YUKI_AGENT);
    if (result.state !== "completed") throw new Error(result.reason);
    const [sg, mint] = result.shortlist.candidates;
    expect(sg.reasons[0]).toBe("日本語対応のスタッフがいます");
    expect(sg.reasons).toContain("宿泊先の近くです（新沙）");
    expect(mint.reasons[0]).toBe("日本語の通訳に対応しています");
    for (const c of result.shortlist.candidates) for (const r of c.reasons) expect(hasBannedComparison(r)).toBe(false);
  });

  it("adds verifiedVisits and reviewStats for display only, and hides reviewStats below 3 reviews", async () => {
    const mintStat = (await platformStore.reviewStats()).find((r) => r.clinicId === "cln_mint")!;
    await platformStore.putReviewStats({ ...mintStat, n: 2, nullifiers: mintStat.nullifiers.slice(0, 2), reviews: mintStat.reviews.slice(0, 2) });
    const result = await matchClinics(yukiRequest(), YUKI_AGENT);
    if (result.state !== "completed") throw new Error(result.reason);
    const [sg, mint, ara] = result.shortlist.candidates;
    expect(sg).toMatchObject({ verifiedVisits: 1240, reviewStats: { n: 18, avgRating: 4.6 } });
    expect(mint.verifiedVisits).toBe(980);
    expect(mint.reviewStats).toBeUndefined();
    expect(ara).toMatchObject({ verifiedVisits: 640, reviewStats: { n: 5, avgRating: 3 } });
    // Not scored: removing every stat leaves the scores as they were.
    const scores = result.shortlist.candidates.map((c) => c.score);
    for (const s of await platformStore.reviewStats()) await platformStore.putReviewStats({ ...s, n: 3, avgRating: 1 });
    const again = await matchClinics(yukiRequest(), YUKI_AGENT);
    if (again.state !== "completed") throw new Error(again.reason);
    expect(again.shortlist.candidates.map((c) => c.score)).toEqual(scores);
  });

  it("rejects a request made for another customer agent and an ineligible visitor", async () => {
    expect(await matchClinics(yukiRequest(), "cag_7f3k2")).toEqual({ state: "rejected", reason: "customer_agent_mismatch" });
    expect(await matchClinics(yukiRequest({ visitorProfile: { nationality: "KR", residency: "short_term_visitor", ageBand: "25-29" } }), YUKI_AGENT)).toEqual({
      state: "rejected",
      reason: "not_eligible_foreign_patient",
    });
    expect(await platformStore.matchLogs()).toEqual([]);
  });

  it("drops Ara once an operator activates an exclude_clinic rule for Japanese customers (10 demo row 8)", async () => {
    await platformStore.putRule(
      rule("rule_003", { nationalities: ["JP"] }, { kind: "exclude_clinic", clinicIds: ["cln_ara"] }, { status: "proposed", source: "auto_proposal" }),
    );
    const before = await matchClinics(yukiRequest(), YUKI_AGENT);
    if (before.state !== "completed") throw new Error(before.reason);
    expect(before.shortlist.appliedRuleIds).toEqual([]);

    await activateRule("rule_003", { approvedBy: "ops_demo" });
    const after = await matchClinics(yukiRequest(), YUKI_AGENT);
    if (after.state !== "completed") throw new Error(after.reason);
    expect(after.shortlist.candidates.map((c) => c.clinicId)).toEqual(["cln_seoul_glow", "cln_mint"]);
    expect(after.shortlist.appliedRuleIds).toEqual(["rule_003"]);
    expect(after.log.candidatesBeforeRules.map((c) => c.clinicId)).toContain("cln_ara");
    expect(await platformStore.rule("rule_003")).toMatchObject({ status: "active", version: 2, appliedCount: 1, approvedBy: "ops_demo" });
    expect((await platformStore.ruleHistory()).map((h) => h.id)).toEqual(["rule_003@v1"]);
  });
});
