import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clock } from "../../clock";
import type { MatchLog, Outcome } from "../../domain";
import { materializeAraBurst } from "../../store";
import { setupPlatformTest, teardownPlatformTest } from "./__fixtures__/offer-cache";
import { YUKI_AGENT, yukiRequest } from "./__fixtures__/requests";
import { matchClinics } from "./matching";
import { injectAraBurst } from "./outcomes";
import { evaluateTriggers, proposeRules, validateRuleDraft, type RuleDraft, type TriggerInput } from "./proposer";
import { activateRule } from "./rules";
import { platformStore, type PlatformSignal } from "./store";

beforeEach(setupPlatformTest);
afterEach(teardownPlatformTest);

const ARA_REASON = "아라의원 · 일본 고객 · 매칭 제외 · 근거: 견적 대비 실결제 평균 +31% (n=20)";

describe("proposer stage 1 on the demo data (10 demo row 7)", () => {
  it("proposes nothing before the burst: the seed Ara outcomes are 31 to 90 days old", async () => {
    const result = await proposeRules();
    expect(result.proposed).toEqual([]);
    expect(result.discarded).toEqual([]);
  });

  it("after the injected burst, proposes excluding Ara for Japanese customers with the +31% (n=20) reason", async () => {
    await injectAraBurst();
    const result = await proposeRules();
    expect(result.proposed).toHaveLength(1);
    const [rule] = result.proposed;
    expect(rule).toMatchObject({
      id: "rule_003",
      version: 1,
      status: "proposed",
      when: { nationalities: ["JP"] },
      then: { kind: "exclude_clinic", clinicIds: ["cln_ara"] },
      reason: ARA_REASON,
      source: "auto_proposal",
      proposedBy: "proposer_v1",
      createdAt: "2026-11-12T10:00:00+09:00",
      expiresAt: "2027-02-10T10:00:00+09:00",
      appliedCount: 0,
    });
    expect(rule.evidence.outcomeIds).toHaveLength(20);
    expect(rule.evidence.summary).toContain("+31% (n=20)");
    expect(await platformStore.rule("rule_003")).toEqual(rule);
  });

  it("once approved, the proposal takes Ara off Yuki's shortlist (10 demo rows 7 and 8)", async () => {
    await injectAraBurst();
    const [rule] = (await proposeRules()).proposed;
    await activateRule(rule.id, { approvedBy: "ops_demo" });
    const result = await matchClinics(yukiRequest(), YUKI_AGENT);
    if (result.state !== "completed") throw new Error(result.reason);
    expect(result.shortlist.appliedRuleIds).toEqual([rule.id]);
    expect(result.shortlist.candidates.map((c) => c.clinicId)).not.toContain("cln_ara");
  });

  it("does not propose the same rule twice", async () => {
    await injectAraBurst();
    await proposeRules();
    expect((await proposeRules()).proposed).toEqual([]);
    expect((await platformStore.rules()).filter((r) => r.status === "proposed")).toHaveLength(1);
  });
});

describe("guardrails: forbidden drafts are dropped", () => {
  const evidence = { outcomeIds: ["out_x"], signalIds: [], summary: "test" };
  const draft = (when: unknown, then: unknown, extra: Partial<RuleDraft> = {}): RuleDraft => ({ when, then, reason: "test", evidence, ...extra });

  it("drops health conditions, nationality prices, unknown clinics and nationality disadvantage without harm", async () => {
    const drafts = [
      draft({ skinType: ["sensitive"] }, { kind: "demote_clinic", clinicIds: ["cln_mint"], delta: 0.1 }),
      draft({ safety: { pregnantOrBreastfeeding: true } }, { kind: "exclude_clinic", clinicIds: ["cln_mint"] }),
      draft({ nationalities: ["CN"] }, { kind: "boost_clinic", clinicIds: ["cln_hanbit"], delta: 0.1, priceKrw: 300_000 }),
      draft({ nationalities: ["CN"] }, { kind: "price_by_nationality", clinicIds: ["cln_hanbit"], surchargeKrw: 50_000 }),
      draft({ nationalities: ["JP"] }, { kind: "exclude_clinic", clinicIds: ["cln_nowhere"] }),
      draft({ nationalities: ["US"] }, { kind: "demote_clinic", clinicIds: ["cln_dahye"], delta: 0.1 }, { evidence: { outcomeIds: [], signalIds: [], summary: "none" } }),
    ];
    const result = await proposeRules({ drafts });
    expect(result.proposed).toEqual([]);
    expect(result.discarded.map((d) => d.errors[0].split(":")[0])).toEqual([
      "health_information",
      "health_information",
      "nationality_price",
      "nationality_price",
      "unknown_clinic",
      "nationality_without_harm",
    ]);
  });

  it("keeps a valid draft, such as a language preference or a budget condition", () => {
    const clinicIds = new Set(["cln_hanbit"]);
    expect(validateRuleDraft(draft({ nationalities: ["CN"] }, { kind: "require_language", languages: ["zh-CN"] }), { clinicIds }).ok).toBe(true);
    expect(validateRuleDraft(draft({ budgetMaxBelowKrw: 200_000 }, { kind: "boost_clinic", clinicIds: ["cln_hanbit"], delta: 0.1 }), { clinicIds }).ok).toBe(true);
  });
});

describe("the other triggers (pure)", () => {
  const base = async (extra: Partial<TriggerInput> = {}): Promise<TriggerInput> => ({
    outcomes: [],
    signals: [],
    matchLogs: [],
    registry: await platformStore.registry(),
    now: clock.now(),
    ...extra,
  });
  const burst = () => materializeAraBurst(clock.now());
  const at = (daysAgo: number) => new Date(clock.now().getTime() - daysAgo * 86_400_000).toISOString();

  it("the quote gap trigger needs 5 outcomes in the segment", async () => {
    const outcomes = burst().map((o) => ({ ...o, satisfaction: 4 }));
    expect(evaluateTriggers(await base({ outcomes: outcomes.slice(0, 4) }))).toEqual([]);
    expect(evaluateTriggers(await base({ outcomes: outcomes.slice(0, 5) }))).toEqual([
      expect.objectContaining({ then: { kind: "exclude_clinic", clinicIds: ["cln_ara"] } }),
    ]);
  });

  it("low satisfaction above 40% demotes by 0.2; 30% does not", async () => {
    const outcomes = burst().map((o, i): Outcome => ({ ...o, quoteGapRatio: 0, satisfaction: i < 9 ? 2 : 4 }));
    expect(evaluateTriggers(await base({ outcomes }))).toEqual([
      expect.objectContaining({ then: { kind: "demote_clinic", clinicIds: ["cln_ara"], delta: 0.2 }, when: { nationalities: ["JP"] } }),
    ]);
    const fewer = outcomes.map((o, i) => ({ ...o, satisfaction: i < 8 ? 2 : 4 }));
    expect(evaluateTriggers(await base({ outcomes: fewer }))).toEqual([]);
  });

  it("response timeouts above half of the referrals demote by 0.15", async () => {
    const log = { at: at(1), request: { visitorProfile: { nationality: "JP" } }, result: { candidates: [{ clinicId: "cln_mint" }] } } as unknown as MatchLog;
    const timeout = (i: number): PlatformSignal => ({ id: `sig_to_${i}`, clinicId: "cln_mint", kind: "response_timeout", value: 1, context: { nationality: "JP" }, at: at(1) });
    const drafts = evaluateTriggers(await base({ matchLogs: Array(6).fill(log), signals: [1, 2, 3, 4].map(timeout) }));
    expect(drafts).toEqual([expect.objectContaining({ then: { kind: "demote_clinic", clinicIds: ["cln_mint"], delta: 0.15 } })]);
    expect(evaluateTriggers(await base({ matchLogs: Array(6).fill(log), signals: [1, 2, 3].map(timeout) }))).toEqual([]);
  });

  it("a satisfaction gap of 0.8 or more between region groups prefers the better one", async () => {
    const make = (clinicId: string, satisfaction: number, i: number): Outcome =>
      ({ ...burst()[0], id: `out_${clinicId}_${i}`, clinicId, satisfaction, quoteGapRatio: 0, visitorProfile: { nationality: "JP", ageBand: "25-29" }, submittedAt: at(2) }) as Outcome;
    const outcomes = [...Array.from({ length: 8 }, (_, i) => make("cln_seoul_glow", 5, i)), ...Array.from({ length: 8 }, (_, i) => make("cln_hanbit", 4, i))];
    const drafts = evaluateTriggers(await base({ outcomes }));
    expect(drafts).toEqual([
      expect.objectContaining({ when: { nationalities: ["JP"] }, then: { kind: "prefer_area", areas: ["gangnam", "sinsa", "apgujeong"], delta: 0.1 } }),
    ]);
    expect(evaluateTriggers(await base({ outcomes: outcomes.slice(1) }))).toEqual([]);
  });

  it("two side effect reports exclude the clinic for everyone, urgently, and suspend it at once", async () => {
    const report = (i: number): PlatformSignal => ({ id: `sig_se_${i}`, clinicId: "cln_dahye", kind: "side_effect_report", value: 1, context: { outcomeId: `out_se_${i}` }, at: at(3) });
    expect(evaluateTriggers(await base({ signals: [report(1)] }))).toEqual([]);
    for (const i of [1, 2]) await platformStore.putSignal(report(i));
    const result = await proposeRules();
    expect(result.proposed).toEqual([expect.objectContaining({ when: {}, then: { kind: "exclude_clinic", clinicIds: ["cln_dahye"] } })]);
    expect(result.proposed[0].reason.startsWith("[긴급]")).toBe(true);
    expect(result.suspended).toEqual(["cln_dahye"]);
    expect((await platformStore.clinic("cln_dahye"))!.verificationStatus).toBe("suspended");
  });
});
