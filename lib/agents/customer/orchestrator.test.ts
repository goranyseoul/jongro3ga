import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeFetch } from "../../a2a/__fixtures__/route-fetch";
import { agentTimeline } from "../../a2a/log";
import { getStore } from "../../store";
import { proveOffer, verifyOffer } from "../../zk/client";
import { draftRequest } from "./intent";
import { getRequestView, runRequest } from "./orchestrator";
import { customerStore } from "./store";
import { YUKI, bundleFor, catalog, draftYuki, logOf, setupCustomerTest, teardownCustomerTest } from "./__fixtures__/setup";

// T08 orchestrator acceptance (10-build-plan.md): through the real rpc routes (routeFetch), fixture LLM mode.
// Only the glowpass wallet server (lib/zk/client) is mocked.

vi.mock("../../zk/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../zk/client")>()),
  proveOffer: vi.fn(),
  verifyOffer: vi.fn(),
}));

beforeEach(async () => {
  await setupCustomerTest();
  vi.mocked(proveOffer).mockReset().mockImplementation(async (persona, offerId) => bundleFor(persona, offerId));
  vi.mocked(verifyOffer).mockReset().mockResolvedValue({ ok: true, reason: "verified", unanchored: true });
});
afterEach(teardownCustomerTest);

/** A fetch where Ara's rpc never answers (it waits for the caller's abort), everything else is routeFetch. */
const araSilent: typeof fetch = async (input, init) => {
  const url = new URL(new Request(input, init).url);
  if (url.pathname === "/a2a/clinics/ara/rpc") {
    return new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    });
  }
  return routeFetch(input, init);
};

describe("draftRequest (02 요청 정리 defaults, demo row 2)", () => {
  it("drafts Yuki's request from one sentence: recipe minimum 2cc, stay area group, budget, trip, language", async () => {
    const request = await draftYuki();
    expect(request.status).toBe("draft");
    expect(request.rawUtterance).toBe("リジュラン受けたい");
    expect(request.request).toMatchObject({
      customerAgentId: YUKI.agentId,
      procedureId: "rejuran_healer",
      amount: { value: 2, unit: "cc" },
      budgetKrw: { max: 450_000 },
      areas: ["sinsa", "gangnam", "apgujeong"],
      languages: ["ja"],
      dateWindow: { from: "2026-11-13", to: "2026-11-15" },
      visitorProfile: { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true },
    });
    const log = await logOf(request.id);
    expect(log.map((e) => e.skillId)).toEqual(["platform.recipe"]);
  });

  it("returns the missing slot and stores nothing when the procedure is unknown", async () => {
    const result = await draftRequest(YUKI.customerId, "何かいい施術ある?", { fetchRecipe: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.missing).toContain("procedureId");
    expect(result.followUpQuestion).toBeTruthy();
    expect(await customerStore.request(result.requestId)).toBeUndefined();
  });
});

describe("runRequest: Yuki to the comparison (10 T08, demo rows 3 and 4)", () => {
  it("reaches comparing with Seoul Glow, Mint and Ara quoted and the 07 verdict labels", async () => {
    const draft = await draftYuki();
    const done = await runRequest(draft.id, { fetchImpl: routeFetch, offerCatalog: catalog });
    expect(done.status).toBe("comparing");
    expect(done.failure).toBeUndefined();

    const view = (await getRequestView(draft.id))!;
    expect(view.request.status).toBe("comparing");
    expect(view.request.matchId).toMatch(/^mt_/);
    const byClinic = Object.fromEntries(view.quotes.map((q) => [q.quote.clinicId, q]));
    expect(view.quotes.map((q) => q.quote.clinicId)).toEqual(["cln_seoul_glow", "cln_mint", "cln_ara"]);

    // 07 기준 테스트 케이스 표
    expect(byClinic.cln_mint!.verdict).toMatchObject({ label: "underdosed", doseFlag: "below_typical", normalizedUnitKrw: 99_000 });
    expect(byClinic.cln_seoul_glow!.verdict).toMatchObject({ label: "fair", priceBand: "mid", normalizedUnitKrw: 170_000 });
    expect(byClinic.cln_ara!.verdict).toMatchObject({ label: "fair", normalizedUnitKrw: 165_000 });
    expect(byClinic.cln_ara!.verdict!.clinicFlags.map((f) => f.code)).toContain("paid_more_than_quoted");

    // ZK: Mint's first visit event, applied after the clinic verified the proof (demo row 4).
    expect(byClinic.cln_mint!.quote).toMatchObject({ priceKrw: 99_000, offerApplied: { offerId: "ofr_mint_rejuran_first_visit", verified: true } });
    expect(byClinic.cln_seoul_glow!.quote.offerApplied).toBeUndefined();
    expect(byClinic.cln_seoul_glow!.quote.priceKrw).toBe(340_000);

    // The comparison sentence in Japanese, numbers from the verdicts (fixture template).
    expect(view.request.summary?.text).toContain("量が少なめ");
  });

  it("goes on with the clinics that answered when one never does, and reports the timeout once", async () => {
    const draft = await draftYuki();
    const done = await runRequest(draft.id, { fetchImpl: araSilent, timeoutMs: 300, offerCatalog: catalog });
    expect(done.status).toBe("comparing");
    const view = (await getRequestView(draft.id))!;
    expect(view.quotes.map((q) => q.quote.clinicId)).toEqual(["cln_seoul_glow", "cln_mint"]);
    expect(view.quotes.every((q) => q.verdict !== undefined)).toBe(true);

    const signals = (await logOf(draft.id)).filter((e) => e.skillId === "platform.report_signal");
    expect(signals).toHaveLength(1);
    expect(signals[0]!.state).toBe("TASK_STATE_COMPLETED");
    const sent = (signals[0]!.request as { params: { message: { parts: Array<{ data?: Record<string, unknown> }> } } }).params.message.parts.find((p) => p.data)!.data;
    expect(sent).toMatchObject({ schema: "pibu/signal-report@1", clinicId: "cln_ara", kind: "response_timeout", requestId: draft.id });
    expect(view.request.steps.some((s) => s.kind === "quote_missing" && s.clinicId === "cln_ara")).toBe(true);
  });

  it("fails with no_quotes when no clinic answers", async () => {
    const draft = await draftYuki();
    const silent: typeof fetch = async (input, init) => {
      const url = new URL(new Request(input, init).url);
      if (url.pathname.startsWith("/a2a/clinics/") && url.pathname.endsWith("/rpc")) {
        return new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
      }
      return routeFetch(input, init);
    };
    const done = await runRequest(draft.id, { fetchImpl: silent, timeoutMs: 200, offerCatalog: catalog });
    expect(done).toMatchObject({ status: "failed", failure: { reason: "no_quotes" } });
    expect((await logOf(draft.id)).filter((e) => e.skillId === "platform.report_signal")).toHaveLength(3);
    expect((await logOf(draft.id)).some((e) => e.skillId === "platform.judge_quote")).toBe(false);
  });

  it("ties every call of the request to contextId = requestId, in the 03 sequence order", async () => {
    const draft = await draftYuki();
    await runRequest(draft.id, { fetchImpl: routeFetch, offerCatalog: catalog });
    const timeline = await agentTimeline(getStore(), draft.id);
    const skills = timeline.map((t) => t.skillId);
    expect(skills[0]).toBe("platform.recipe");
    expect(skills[1]).toBe("platform.match_clinics");
    expect(skills.filter((s) => s === "clinic.quote")).toHaveLength(3);
    expect(skills.filter((s) => s === "clinic.offers")).toHaveLength(3);
    expect(skills.at(-1)).toBe("platform.judge_quote");
    expect(skills.indexOf("platform.judge_quote")).toBeGreaterThan(skills.lastIndexOf("clinic.quote"));
    expect(timeline.every((t) => t.actor.agentId === YUKI.agentId)).toBe(true);
    // The platform copy carried residency and age band, the clinic copies did not (consent.ts).
    const log = await logOf(draft.id);
    const dataOf = (e: (typeof log)[number]) =>
      (e.request as { params: { message: { parts: Array<{ data?: Record<string, unknown> }> } } }).params.message.parts.find((p) => p.data)!.data!;
    const matchData = dataOf(log.find((e) => e.skillId === "platform.match_clinics")!);
    expect(matchData.visitorProfile).toMatchObject({ residency: "short_term_visitor", ageBand: "25-29" });
    for (const quote of log.filter((e) => e.skillId === "clinic.quote")) {
      const data = dataOf(quote);
      expect(data.visitorProfile).toEqual({ nationality: "JP", firstKProcedure: true });
      expect(data).not.toHaveProperty("budgetKrw");
    }
  });
});

describe("runRequest: who is not matched (08 2절)", () => {
  it("ends a Korean customer's request as failed not_eligible_foreign_patient without asking any clinic", async () => {
    const result = await draftRequest("cus_jisoo", "리쥬란 받고 싶어", { fetchImpl: routeFetch });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const done = await runRequest(result.request.id, { fetchImpl: routeFetch, offerCatalog: catalog });
    expect(done).toMatchObject({ status: "failed", failure: { reason: "not_eligible_foreign_patient" } });
    expect(done.steps.map((s) => s.kind)).toContain("eligibility");
    const skills = (await logOf(result.request.id)).map((e) => e.skillId);
    expect(skills.some((s) => s?.startsWith("clinic."))).toBe(false);
    expect(skills).not.toContain("platform.match_clinics");
  });

  it("ends a foreign resident's request as failed with the platform's rejection reason", async () => {
    const profile = (await customerStore.profile(YUKI.customerId))!;
    await customerStore.putProfile({ ...profile, residency: "resident" });
    const draft = await draftYuki();
    const done = await runRequest(draft.id, { fetchImpl: routeFetch, offerCatalog: catalog });
    expect(done).toMatchObject({ status: "failed", failure: { reason: "not_eligible_foreign_patient" } });
    const match = (await logOf(draft.id)).find((e) => e.skillId === "platform.match_clinics");
    expect(match?.state).toBe("TASK_STATE_REJECTED");
  });

  it("sends nothing without a privacy consent in the ledger", async () => {
    const draft = await draftYuki();
    await getStore().remove("customer", "consents", "cns_0002");
    const done = await runRequest(draft.id, { fetchImpl: routeFetch, offerCatalog: catalog });
    expect(done).toMatchObject({ status: "failed", failure: { reason: "consent_missing" } });
    expect((await logOf(draft.id)).map((e) => e.skillId)).toEqual(["platform.recipe"]);
  });
});
