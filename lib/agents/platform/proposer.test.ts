import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClinicRegistryEntry, Outcome, Signal } from "../../domain/platform";
import type { ToolCallResult } from "../../llm/index";
import { createMemoryStore, type MemoryStore } from "../../store/memory";
import { runClaude } from "../../llm/index";
import { evaluateTriggers, runProposer, TRIGGERS } from "./proposer";
import { screenDraft, type ScreenContext } from "./proposer-guardrails";
import { approveRule, getRule, listRuleHistory, rejectRule, retireRule, RuleTransitionError, expireRules } from "./proposer-rules";
import { ARA_BURST, injectAraBurst } from "./signals-demo";
import { DAY_MS, PLATFORM_COLLECTIONS, loadWindow, toKstIso } from "./signals";

vi.mock("../../llm/index", () => ({ runClaude: vi.fn() }));

const NOW = new Date("2026-11-12T10:00:00+09:00");
const daysAgo = (days: number) => toKstIso(new Date(NOW.getTime() - days * DAY_MS));

function clinic(id: string, area: ClinicRegistryEntry["area"], mode: ClinicRegistryEntry["operationMode"], name: string): ClinicRegistryEntry {
  return {
    id,
    slug: id.slice(4),
    name: { ko: name },
    area,
    agentCardUrl: `http://localhost/a2a/clinics/${id}/agent-card.json`,
    operationMode: mode,
    dataSources: ["sms"],
    lastVerifiedAt: "2026-11-01",
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified",
    languages: [{ locale: "ja", mode: "interpreter" }],
  };
}

const REGISTRY = [
  clinic("cln_seoul_glow", "sinsa", "clinic", "서울글로우의원"),
  clinic("cln_mint", "gangnam", "proxy", "민트피부과의원"),
  clinic("cln_ara", "apgujeong", "proxy", "아라의원"),
  clinic("cln_hanbit", "myeongdong", "proxy", "한빛의원"),
  clinic("cln_dahye", "hongdae", "clinic", "다혜피부과의원"),
];

let seq = 0;
function outcome(partial: Partial<Outcome> & { clinicId: string; at: string }): Outcome {
  seq += 1;
  const id = partial.outcomeId ?? `out_t${String(seq).padStart(3, "0")}`;
  const { at, ...rest } = partial;
  return {
    schema: "pibu/outcome@1",
    id,
    outcomeId: id,
    bookingId: `bkg_t${seq}`,
    procedureId: "rejuran_healer",
    checkpoint: "D0",
    paidKrw: 330_000,
    receivedAmount: { value: 2, unit: "cc" },
    productVerified: "box_shown",
    receiptAttached: true,
    satisfaction: 4,
    painScore: 2,
    downtimeDaysActual: 1,
    wouldReturn: true,
    sideEffects: [],
    visitorProfile: { nationality: "JP", ageBand: "25-29" },
    submittedAt: at,
    receivedAt: at,
    ...rest,
  };
}

/** The seed's four base Ara outcomes: mean gap 0.15, 31 to 90 days before the reference day. */
function baseAraOutcomes(): Outcome[] {
  return [
    outcome({ clinicId: "cln_ara", at: daysAgo(31), quotedKrw: 330_000, quoteGapRatio: 0.1 }),
    outcome({ clinicId: "cln_ara", at: daysAgo(50), quotedKrw: 330_000, quoteGapRatio: 0.15 }),
    outcome({ clinicId: "cln_ara", at: daysAgo(70), quotedKrw: 330_000, quoteGapRatio: 0.18 }),
    outcome({ clinicId: "cln_ara", at: daysAgo(90), quotedKrw: 330_000, quoteGapRatio: 0.17 }),
  ];
}

async function seed(outcomes: Outcome[] = [], signals: Signal[] = []): Promise<MemoryStore> {
  const store = createMemoryStore();
  for (const entry of REGISTRY) await store.put("platform", PLATFORM_COLLECTIONS.registry, entry);
  for (const o of outcomes) await store.put("platform", PLATFORM_COLLECTIONS.outcomes, o);
  for (const s of signals) await store.put("platform", PLATFORM_COLLECTIONS.signals, s);
  await store.put("platform", PLATFORM_COLLECTIONS.rules, {
    id: "rule_001",
    version: 1,
    status: "active",
    when: { nationalities: ["CN"] },
    then: { kind: "require_language", languages: ["zh-CN"] },
    reason: "seed",
    evidence: { outcomeIds: [], signalIds: [], summary: "seed" },
    source: "operator",
    createdAt: "2026-10-01T10:00:00+09:00",
    activatedAt: "2026-10-01T10:00:00+09:00",
    appliedCount: 0,
  });
  return store;
}

const failingLlm = vi.fn(async (): Promise<ToolCallResult> => {
  throw new Error("api unavailable");
});

beforeEach(() => {
  seq = 0;
  failingLlm.mockClear();
  vi.mocked(runClaude).mockReset();
});

describe("triggers (07 section 4)", () => {
  it("ara burst: 20 injected outcomes make an exclude_clinic candidate for JP at cln_ara with +31% (n=20)", async () => {
    const store = await seed(baseAraOutcomes());
    const injected = await injectAraBurst(store, NOW, "/nonexistent-root");
    expect(injected.injected).toBe(20);

    const candidates = evaluateTriggers(await loadWindow(store, NOW));
    expect(candidates).toHaveLength(1);
    const [candidate] = candidates;
    expect(candidate.key).toBe("quote_gap:cln_ara:JP");
    expect(candidate.when).toEqual({ nationalities: ["JP"] });
    expect(candidate.then).toEqual({ kind: "exclude_clinic", clinicIds: ["cln_ara"] });
    // the 4 base outcomes are outside the 30 day window and do not count
    expect(candidate.stats.n).toBe(20);
    expect(candidate.stats.meanGap).toBeCloseTo(0.31, 9);
    expect(candidate.evidence.outcomeIds).toEqual(injected.outcomeIds);
    expect(candidate.templateSummary).toBe("최근 30일 견적 대비 실결제 평균 +31% (n=20)");
  });

  it("base outcomes alone do not trigger: n=4, mean 0.15, all 31 to 90 days old", async () => {
    const store = await seed(baseAraOutcomes());
    expect(evaluateTriggers(await loadWindow(store, NOW))).toEqual([]);

    // even moved inside the window, 4 outcomes at 0.15 are under both n >= 5 and mean > 0.20
    const inside = baseAraOutcomes().map((o, i) => ({ ...o, submittedAt: daysAgo(i + 1), receivedAt: daysAgo(i + 1) }));
    const store2 = await seed(inside);
    expect(evaluateTriggers(await loadWindow(store2, NOW))).toEqual([]);
  });

  it("quote gap boundaries: mean exactly 0.20 does not trigger, 0.21 does, n=4 never does", async () => {
    const make = (gap: number, n: number) => Array.from({ length: n }, (_, i) => outcome({ clinicId: "cln_mint", at: daysAgo(i + 1), quoteGapRatio: gap }));
    expect(evaluateTriggers(await loadWindow(await seed(make(0.2, 5)), NOW))).toEqual([]);
    expect(evaluateTriggers(await loadWindow(await seed(make(0.21, 5)), NOW)).map((c) => c.key)).toEqual(["quote_gap:cln_mint:JP"]);
    expect(evaluateTriggers(await loadWindow(await seed(make(0.5, 4)), NOW))).toEqual([]);
    // the window edge: exactly 30 days back is inside, 30 days and one minute is outside
    const edge = [...make(0.3, 4), outcome({ clinicId: "cln_mint", at: daysAgo(30), quoteGapRatio: 0.3 })];
    expect(evaluateTriggers(await loadWindow(await seed(edge), NOW))).toHaveLength(1);
    const past = [...make(0.3, 4), outcome({ clinicId: "cln_mint", at: toKstIso(new Date(NOW.getTime() - 30 * DAY_MS - 60_000)), quoteGapRatio: 0.3 })];
    expect(evaluateTriggers(await loadWindow(await seed(past), NOW))).toEqual([]);
  });

  it("low satisfaction: ratio above 0.4 with n >= 5 demotes by 0.2, exactly 0.4 does not", async () => {
    const make = (low: number, n: number) =>
      Array.from({ length: n }, (_, i) => outcome({ clinicId: "cln_mint", at: daysAgo(i + 1), satisfaction: i < low ? 2 : 5, visitorProfile: { nationality: "US", ageBand: "30-34" } }));
    expect(evaluateTriggers(await loadWindow(await seed(make(2, 5)), NOW))).toEqual([]);
    const [candidate] = evaluateTriggers(await loadWindow(await seed(make(3, 5)), NOW));
    expect(candidate.key).toBe("low_satisfaction:cln_mint:US");
    expect(candidate.then).toEqual({ kind: "demote_clinic", clinicIds: ["cln_mint"], delta: TRIGGERS.lowSatisfaction.delta });
  });

  it("response timeouts: more than half of at least 5 quote requests timed out demotes by 0.15", async () => {
    const signal = (i: number, kind: Signal["kind"]): Signal => ({ id: `sig_t${i}`, clinicId: "cln_dahye", kind, value: 1, context: { nationality: "US" }, at: daysAgo(i + 1) });
    const three = [0, 1, 2].map((i) => signal(i, "response_timeout"));
    const twoRejected = [3, 4].map((i) => signal(i, "rejection"));
    const [candidate] = evaluateTriggers(await loadWindow(await seed([], [...three, ...twoRejected]), NOW));
    expect(candidate.key).toBe("response_timeout:cln_dahye:US");
    expect(candidate.then).toEqual({ kind: "demote_clinic", clinicIds: ["cln_dahye"], delta: 0.15 });
    expect(candidate.evidence.signalIds).toEqual(["sig_t0", "sig_t1", "sig_t2"]);
    // 2 of 5 is not more than half
    const two = [0, 1].map((i) => signal(i, "response_timeout"));
    const threeRejected = [2, 3, 4].map((i) => signal(i, "rejection"));
    expect(evaluateTriggers(await loadWindow(await seed([], [...two, ...threeRejected]), NOW))).toEqual([]);
  });

  it("area preference: a 0.8 point satisfaction gap between area groups with n >= 8 each prefers the better group", async () => {
    const group = (clinicId: string, satisfaction: number, n: number) =>
      Array.from({ length: n }, (_, i) => outcome({ clinicId, at: daysAgo(i + 1), satisfaction, visitorProfile: { nationality: "CN", ageBand: "30-34" } }));
    const store = await seed([...group("cln_hanbit", 5, 8), ...group("cln_dahye", 4, 4), ...group("cln_dahye", 5, 4), ...group("cln_mint", 4, 8)]);
    // myeongdong 5.0 (n=8) vs hongdae 4.5 (n=8) vs gangnam_sinsa 4.0 (n=8): best minus worst is 1.0
    const [candidate] = evaluateTriggers(await loadWindow(store, NOW)).filter((c) => c.trigger === "area_preference");
    expect(candidate.when).toEqual({ nationalities: ["CN"] });
    expect(candidate.then).toEqual({ kind: "prefer_area", areas: ["myeongdong"], delta: 0.1 });
    // n = 7 in a group is not enough
    const small = await seed([...group("cln_hanbit", 5, 7), ...group("cln_mint", 3, 8)]);
    expect(evaluateTriggers(await loadWindow(small, NOW)).filter((c) => c.trigger === "area_preference")).toEqual([]);
  });
});

describe("guardrail screen (07 section 4)", () => {
  const ctxFor = (outcomes: Outcome[], signals: Signal[] = []): ScreenContext => ({
    clinicIds: new Set(REGISTRY.map((c) => c.id)),
    outcomes: new Map(outcomes.map((o) => [o.outcomeId, o])),
    signals: new Map(signals.map((s) => [s.id, s])),
  });
  const harmed = outcome({ clinicId: "cln_ara", at: daysAgo(2), quoteGapRatio: 0.3 });
  const happy = outcome({ clinicId: "cln_mint", at: daysAgo(2), satisfaction: 5 });
  const ctx = ctxFor([harmed, happy]);
  const base = {
    when: { nationalities: ["JP"] },
    then: { kind: "exclude_clinic", clinicIds: ["cln_ara"] },
    reason: "r",
    evidence: { outcomeIds: [harmed.outcomeId], signalIds: [], summary: "s" },
  };

  it("guardrail keeps a nationality exclusion backed by harm", () => {
    expect(screenDraft(base, ctx).ok).toBe(true);
  });

  it("guardrail drops health information in conditions, top level or nested", () => {
    for (const when of [{ nationalities: ["JP"], skinType: "sensitive" }, { safetyInfo: { pregnantOrBreastfeeding: true } }, { nationalities: ["JP"], allergies: ["lidocaine"] }]) {
      const result = screenDraft({ ...base, when }, ctx);
      expect(result).toMatchObject({ ok: false, reason: "forbidden_health_condition" });
    }
  });

  it("guardrail drops nationality based pricing in any form", () => {
    const priceField = screenDraft({ ...base, then: { kind: "boost_clinic", clinicIds: ["cln_mint"], delta: 0.1, priceMultiplier: 1.2 } }, ctx);
    expect(priceField).toMatchObject({ ok: false, reason: "forbidden_nationality_pricing" });
    const priceKind = screenDraft({ ...base, then: { kind: "adjust_price", clinicIds: ["cln_mint"] } }, ctx);
    expect(priceKind).toMatchObject({ ok: false, reason: "forbidden_nationality_pricing" });
    const surcharge = screenDraft({ ...base, surchargePct: 10 }, ctx);
    expect(surcharge).toMatchObject({ ok: false, reason: "forbidden_nationality_pricing" });
  });

  it("guardrail drops unknown clinic ids, unknown outcomes and nationality rules without harm", () => {
    expect(screenDraft({ ...base, then: { kind: "exclude_clinic", clinicIds: ["cln_ghost"] } }, ctx)).toMatchObject({ ok: false, reason: "unknown_clinic" });
    expect(screenDraft({ ...base, evidence: { ...base.evidence, outcomeIds: ["out_missing"] } }, ctx)).toMatchObject({ ok: false, reason: "unknown_outcome" });
    expect(screenDraft({ ...base, then: { kind: "boost_clinic", clinicIds: ["cln_mint"], delta: 0.1 } }, ctx)).toMatchObject({ ok: false, reason: "nationality_preference" });
    expect(
      screenDraft({ ...base, then: { kind: "exclude_clinic", clinicIds: ["cln_mint"] }, evidence: { ...base.evidence, outcomeIds: [happy.outcomeId] } }, ctx),
    ).toMatchObject({ ok: false, reason: "nationality_without_harm" });
    expect(screenDraft({ ...base, then: { kind: "demote_clinic", clinicIds: ["cln_ara"], delta: 0.9 } }, ctx)).toMatchObject({ ok: false, reason: "invalid_shape" });
  });

  it("guardrail allows language and area preference by nationality without harm evidence", () => {
    expect(screenDraft({ ...base, then: { kind: "require_language", languages: ["ja"] }, evidence: { ...base.evidence, outcomeIds: [happy.outcomeId] } }, ctx).ok).toBe(true);
    expect(screenDraft({ ...base, then: { kind: "prefer_area", areas: ["sinsa"], delta: 0.1 } }, ctx).ok).toBe(true);
  });
});

describe("claude step", () => {
  async function burstStore() {
    const store = await seed(baseAraOutcomes());
    const injected = await injectAraBurst(store, NOW, "/nonexistent-root");
    return { store, injected };
  }

  it("fixture path: runClaude is called with the reasoning tier, the proposer fixture key and a forced propose_rules tool; drafts are screened", async () => {
    const { store, injected } = await burstStore();
    const hanbitHarm = outcome({ clinicId: "cln_hanbit", at: daysAgo(3), satisfaction: 1, visitorProfile: { nationality: "CN", ageBand: "30-34" } });
    await store.put("platform", PLATFORM_COLLECTIONS.outcomes, hanbitHarm);

    vi.mocked(runClaude).mockResolvedValue({
      text: "",
      toolCalls: [
        {
          name: "propose_rules",
          input: {
            rules: [
              {
                candidateKey: "quote_gap:cln_ara:JP",
                when: { nationalities: ["JP"] },
                then: { kind: "exclude_clinic", clinicIds: ["cln_ara"] },
                reason: "아라의원에서 일본 고객의 실결제가 견적보다 꾸준히 높아요.",
                evidence: { outcomeIds: injected.outcomeIds, signalIds: [], summary: "최근 30일 일본 고객 20건, 견적 대비 실결제 평균 +31% (n=20)" },
              },
              {
                when: { nationalities: ["CN"] },
                then: { kind: "prefer_area", areas: ["myeongdong"], delta: 0.1 },
                reason: "중국 고객은 명동 병원 접근성을 선호했어요.",
                evidence: { outcomeIds: [hanbitHarm.outcomeId], signalIds: [], summary: "중국 고객 결과 1건" },
              },
              {
                when: { nationalities: ["JP"], skinType: "sensitive" },
                then: { kind: "demote_clinic", clinicIds: ["cln_mint"], delta: 0.1 },
                reason: "민감성 피부 일본 고객",
                evidence: { outcomeIds: [injected.outcomeIds[0]], signalIds: [], summary: "x" },
              },
              {
                when: { nationalities: ["CN"] },
                then: { kind: "boost_clinic", clinicIds: ["cln_hanbit"], delta: 0.1, priceMultiplier: 1.3 },
                reason: "중국 고객에게 다른 가격",
                evidence: { outcomeIds: [hanbitHarm.outcomeId], signalIds: [], summary: "x" },
              },
              {
                when: {},
                then: { kind: "exclude_clinic", clinicIds: ["cln_unknown"] },
                reason: "없는 병원",
                evidence: { outcomeIds: [hanbitHarm.outcomeId], signalIds: [], summary: "x" },
              },
            ],
          },
        },
      ],
    });

    const run = await runProposer(store, { now: NOW });
    expect(runClaude).toHaveBeenCalledTimes(1);
    const options = vi.mocked(runClaude).mock.calls[0][0];
    expect(options).toMatchObject({ tier: "reasoning", fixtureKey: "proposer", toolChoice: "propose_rules" });
    expect(options.tools?.[0].name).toBe("propose_rules");
    expect(options.messages[0].content).toContain("quote_gap:cln_ara:JP");
    // no personal data in the prompt: no booking ids, no comments
    expect(options.messages[0].content).not.toContain("bkg_");

    expect(run.mode).toBe("claude");
    expect(run.proposed.map((rule) => [rule.id, rule.then.kind])).toEqual([
      ["rule_002", "exclude_clinic"],
      ["rule_003", "prefer_area"],
    ]);
    const ara = run.proposed[0];
    expect(ara).toMatchObject({ status: "proposed", version: 1, source: "auto_proposal", proposedBy: "claude-opus-5-5", when: { nationalities: ["JP"] } });
    expect(ara.reason).toBe("아라의원에서 일본 고객의 실결제가 견적보다 꾸준히 높아요.");
    expect(ara.evidence.summary).toContain("+31% (n=20)");
    expect(run.dropped.map((d) => d.reason).sort()).toEqual(["forbidden_health_condition", "forbidden_nationality_pricing", "unknown_clinic"]);

    // stored, with a version 1 history entry
    expect(await getRule(store, "rule_002")).toMatchObject({ status: "proposed", version: 1 });
    expect((await listRuleHistory(store, "rule_002")).map((h) => [h.version, h.event])).toEqual([[1, "proposed"]]);

    // running again proposes nothing new
    const again = await runProposer(store, { now: NOW });
    expect(again.proposed).toEqual([]);
    expect(again.skipped.map((s) => s.reason)).toContain("already_proposed");
  });

  it("fixture path keeps the trigger's numbers when Claude rewrites them, and caps extras at 2", async () => {
    const { store, injected } = await burstStore();
    const extra = (language: "ja" | "en" | "ko") => ({
      when: { nationalities: ["JP"] },
      then: { kind: "require_language", languages: [language] },
      reason: "언어",
      evidence: { outcomeIds: [injected.outcomeIds[0]], signalIds: [], summary: "s" },
    });
    const llm = vi.fn(async (): Promise<ToolCallResult> => ({
      text: "",
      toolCalls: [
        {
          name: "propose_rules",
          input: {
            rules: [
              {
                candidateKey: "quote_gap:cln_ara:JP",
                when: { nationalities: ["JP"] },
                then: { kind: "exclude_clinic", clinicIds: ["cln_ara"] },
                reason: "다시 쓴 사유",
                evidence: { outcomeIds: injected.outcomeIds, signalIds: [], summary: "평균 +45% (n=12)" },
              },
              extra("ja"),
              extra("en"),
              extra("ko"),
            ],
          },
        },
      ],
    }));
    const run = await runProposer(store, { now: NOW, llm });
    expect(run.proposed[0].reason).toBe("다시 쓴 사유");
    expect(run.proposed[0].evidence.summary).toBe("최근 30일 견적 대비 실결제 평균 +31% (n=20)");
    expect(run.proposed).toHaveLength(3);
    expect(run.dropped.map((d) => d.reason)).toEqual(["numbers_changed", "too_many_extras"]);
  });

  it("template fallback: when Claude fails the candidates are proposed with template wording", async () => {
    const { store } = await burstStore();
    const run = await runProposer(store, { now: NOW, llm: failingLlm });
    expect(failingLlm).toHaveBeenCalledTimes(1);
    expect(run.mode).toBe("template");
    expect(run.claudeError).toBe("api unavailable");
    expect(run.proposed).toHaveLength(1);
    expect(run.proposed[0]).toMatchObject({
      id: "rule_002",
      proposedBy: "template",
      when: { nationalities: ["JP"] },
      then: { kind: "exclude_clinic", clinicIds: ["cln_ara"] },
      evidence: { summary: "최근 30일 견적 대비 실결제 평균 +31% (n=20)" },
    });
    expect(run.proposed[0].reason).toContain("아라의원");
  });

  it("template fallback also covers a reply without the propose_rules tool call", async () => {
    const { store } = await burstStore();
    const run = await runProposer(store, { now: NOW, llm: async () => ({ text: "no tool", toolCalls: [] }) });
    expect(run.mode).toBe("template");
    expect(run.proposed[0].proposedBy).toBe("template");
  });

  it("nothing to propose: the base outcomes alone yield no rule", async () => {
    const store = await seed(baseAraOutcomes());
    const run = await runProposer(store, { now: NOW, llm: failingLlm });
    expect(run.candidates).toEqual([]);
    expect(run.proposed).toEqual([]);
  });

  it("emergency: 2 side effect reports suspend the clinic at once and propose an urgent exclusion for the operator", async () => {
    const reports = [1, 2].map((i) => outcome({ clinicId: "cln_mint", at: daysAgo(i), sideEffects: ["bruising"], visitorProfile: { nationality: i === 1 ? "JP" : "US", ageBand: "25-29" } }));
    const store = await seed(reports);
    const run = await runProposer(store, { now: NOW, llm: failingLlm });
    expect(run.suspendedClinicIds).toEqual(["cln_mint"]);
    const rule = run.proposed[0];
    expect(rule).toMatchObject({ urgent: true, status: "proposed", when: {}, then: { kind: "exclude_clinic", clinicIds: ["cln_mint"] } });
    expect(rule.reason.startsWith("긴급")).toBe(true);
    const registry = await store.get<ClinicRegistryEntry>("platform", PLATFORM_COLLECTIONS.registry, "cln_mint");
    expect(registry?.verificationStatus).toBe("suspended");

    // the operator rejects: the suspension is lifted
    await rejectRule(store, rule.id, "op_1", NOW);
    expect((await store.get<ClinicRegistryEntry>("platform", PLATFORM_COLLECTIONS.registry, "cln_mint"))?.verificationStatus).toBe("verified");
    // the same evidence does not suspend again on the next run
    const again = await runProposer(store, { now: NOW, llm: failingLlm });
    expect(again.suspendedClinicIds).toEqual([]);
    expect(again.skipped[0].reason).toBe("rejected_before");
  });
});

describe("rule lifecycle", () => {
  it("approve makes the rule active, bumps the version, sets a 90 day expiry and keeps history", async () => {
    const store = await seed(baseAraOutcomes());
    await injectAraBurst(store, NOW, "/nonexistent-root");
    const [proposal] = (await runProposer(store, { now: NOW, llm: failingLlm })).proposed;

    const active = await approveRule(store, proposal.id, "op_kim", NOW);
    expect(active).toMatchObject({ status: "active", version: 2, approvedBy: "op_kim", activatedAt: "2026-11-12T10:00:00+09:00", expiresAt: "2027-02-10T10:00:00+09:00" });
    expect(await getRule(store, proposal.id)).toMatchObject({ status: "active", version: 2 });

    const retired = await retireRule(store, proposal.id, "op_kim", new Date(NOW.getTime() + DAY_MS));
    expect(retired).toMatchObject({ status: "retired", version: 3, closedBy: "op_kim" });
    expect((await listRuleHistory(store, proposal.id)).map((h) => [h.version, h.event, h.rule.status])).toEqual([
      [1, "proposed", "proposed"],
      [2, "approved", "active"],
      [3, "retired", "retired"],
    ]);

    await expect(approveRule(store, proposal.id, "op_kim")).rejects.toBeInstanceOf(RuleTransitionError);
    await expect(rejectRule(store, "rule_999", "op_kim")).rejects.toMatchObject({ code: "not_found" });
  });

  it("approve: an expired exclusion is retired by the system", async () => {
    const store = await seed(baseAraOutcomes());
    await injectAraBurst(store, NOW, "/nonexistent-root");
    const [proposal] = (await runProposer(store, { now: NOW, llm: failingLlm })).proposed;
    await approveRule(store, proposal.id, "op_kim", NOW);
    expect(await expireRules(store, new Date(NOW.getTime() + 89 * DAY_MS))).toEqual([]);
    expect(await expireRules(store, new Date(NOW.getTime() + 90 * DAY_MS))).toEqual([proposal.id]);
    expect(await getRule(store, proposal.id)).toMatchObject({ status: "retired", version: 3, closedBy: "system" });
  });
});

describe("ara burst injection", () => {
  it("dates are 1 to 29 days before now, gaps run 0.25 to 0.37 in equal steps, mean exactly 0.31", async () => {
    const store = createMemoryStore();
    const result = await injectAraBurst(store, NOW, "/nonexistent-root");
    expect(result.source).toBe("builtin");
    const outcomes = (await store.list<Outcome>("platform", PLATFORM_COLLECTIONS.outcomes)).sort((a, b) => a.outcomeId.localeCompare(b.outcomeId));
    expect(outcomes).toHaveLength(ARA_BURST.count);
    const gaps = outcomes.map((o) => o.quoteGapRatio as number);
    expect(gaps[0]).toBe(0.25);
    expect(gaps[19]).toBe(0.37);
    const steps = gaps.slice(1).map((g, i) => g - gaps[i]);
    for (const step of steps) expect(step).toBeCloseTo(0.12 / 19, 5);
    expect(result.meanGap).toBeCloseTo(0.31, 12);
    expect(result.meanGapPct).toBe(31);
    for (const o of outcomes) {
      const age = (NOW.getTime() - Date.parse(o.submittedAt)) / DAY_MS;
      expect(age).toBeGreaterThanOrEqual(1);
      expect(age).toBeLessThanOrEqual(29);
      expect(o.visitorProfile.nationality).toBe("JP");
      expect(o.paidKrw).toBe(Math.round(330_000 * (1 + (o.quoteGapRatio as number))));
    }
    // signals as submit_outcome would record them; no price records (verdict sample stays n = 42)
    expect(await store.list("platform", PLATFORM_COLLECTIONS.signals)).toHaveLength(20);
    expect(await store.list("platform", PLATFORM_COLLECTIONS.priceRecords)).toHaveLength(0);
    // injecting again overwrites the same ids
    await injectAraBurst(store, NOW, "/nonexistent-root");
    expect(await store.list("platform", PLATFORM_COLLECTIONS.outcomes)).toHaveLength(20);
  });
});
