import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as clockRoute from "../../app/api/demo/clock/route";
import * as confirmRoute from "../../app/api/demo/confirm-booking/route";
import * as injectRoute from "../../app/api/demo/inject-outcomes/route";
import * as logRoute from "../../app/api/demo/log/route";
import * as resetRoute from "../../app/api/demo/reset/route";
import * as proposeRoute from "../../app/api/ops/rules/propose/route";
import * as ruleActionRoute from "../../app/api/ops/rules/[ruleId]/[action]/route";
import { sendMessage, getTask } from "../a2a/client";
import { taskArtifactData } from "../a2a/wire";
import { resetClock, setClock } from "../clock";
import { inProcessFetch } from "./in-process-fetch";

const env = { ...process.env };
const base = "http://localhost:3000";
const yuki = { agentId: "cag_7f3k2d", role: "customer" as const };
const post = (body?: unknown) => new Request(`${base}/x`, { method: "POST", body: JSON.stringify(body ?? {}) });

beforeEach(async () => {
  process.env.DEMO_MODE = "true";
  process.env.PUBLIC_BASE_URL = base;
  setClock("2026-11-12T10:00:00+09:00");
  const res = await resetRoute.POST();
  expect(res.status).toBe(200);
  setClock("2026-11-12T10:00:00+09:00");
});

afterEach(() => {
  process.env = { ...env };
  resetClock();
});

describe("demo controls", () => {
  it("reset refills the platform offer cache from all five clinic agents", async () => {
    const body = await (await resetRoute.POST()).json();
    expect([...body.offerCache.updated].sort()).toEqual(["cln_ara", "cln_dahye", "cln_hanbit", "cln_mint", "cln_seoul_glow"]);
  });

  it("refuses outside DEMO_MODE", async () => {
    process.env.DEMO_MODE = "false";
    expect((await resetRoute.POST()).status).toBe(403);
    expect((await clockRoute.POST(post({ to: "2026-11-14T13:00:00+09:00" }))).status).toBe(403);
  });

  it("moves the clock", async () => {
    const body = await (await clockRoute.POST(post({ to: "2026-11-14T13:00:00+09:00" }))).json();
    expect(body.now).toBe("2026-11-14T13:00:00+09:00");
  });

  it("runs Yuki's match, quote and booking over A2A, then [예약 확정] completes the customer's task", async () => {
    const match = await sendMessage({
      from: yuki,
      toCardUrl: `${base}/a2a/platform/agent-card.json`,
      skillId: "platform.match_clinics",
      contextId: "req_demo_1",
      fetchImpl: inProcessFetch,
      data: {
        schema: "pibu/procedure-request@1",
        requestId: "req_demo_1",
        customerAgentId: "cag_7f3k2d",
        procedureId: "rejuran_healer",
        amount: { value: 2, unit: "cc" },
        languages: ["ja"],
        dateWindow: { from: "2026-11-13", to: "2026-11-15" },
        visitorProfile: { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true },
      },
    });
    expect(match.status.state).toBe("TASK_STATE_COMPLETED");
    const shortlist = taskArtifactData(match) as { candidates: { clinicId: string; agentCardUrl: string; referralToken: string }[] };
    expect(shortlist.candidates.map((c) => c.clinicId).sort()).toEqual(["cln_ara", "cln_mint", "cln_seoul_glow"]);
    const glow = shortlist.candidates.find((c) => c.clinicId === "cln_seoul_glow")!;

    const quote = await sendMessage({
      from: yuki,
      toCardUrl: glow.agentCardUrl,
      skillId: "clinic.quote",
      contextId: "req_demo_1",
      fetchImpl: inProcessFetch,
      metadata: { referralToken: glow.referralToken },
      extensions: ["https://pibu.app/ext/referral/v1"],
      data: {
        schema: "pibu/procedure-request@1",
        requestId: "req_demo_1",
        customerAgentId: "cag_7f3k2d",
        procedureId: "rejuran_healer",
        amount: { value: 2, unit: "cc" },
        languages: ["ja"],
        dateWindow: { from: "2026-11-13", to: "2026-11-15" },
        visitorProfile: { nationality: "JP", firstKProcedure: true },
      },
    });
    const q = taskArtifactData(quote) as { quoteId: string; priceKrw: number; slots: string[] };
    expect(q.priceKrw).toBe(340000);

    const book = await sendMessage({
      from: yuki,
      toCardUrl: glow.agentCardUrl,
      skillId: "clinic.book",
      contextId: "req_demo_1",
      fetchImpl: inProcessFetch,
      metadata: { referralToken: glow.referralToken },
      data: {
        schema: "pibu/booking-request@1",
        requestId: "req_demo_1",
        quoteId: q.quoteId,
        clinicId: "cln_seoul_glow",
        slot: "2026-11-14T11:00:00+09:00",
        guest: { displayName: "Yuki T.", contactChannel: "line", contactHandle: "yuki_demo", language: "ja" },
        safetyInfo: { pregnantOrBreastfeeding: false, allergies: [], anticoagulants: false, recentIsotretinoin: false, keloidHistory: false },
        consentRef: "cns_0091",
      },
    });
    expect(book.status.state).toBe("TASK_STATE_WORKING");

    const confirmed = await (await confirmRoute.POST(post({}))).json();
    expect(confirmed.confirmedBy).toBe("clinic_staff");
    const after = await getTask({ from: yuki, toCardUrl: glow.agentCardUrl, taskId: book.id, fetchImpl: inProcessFetch });
    expect(after.status.state).toBe("TASK_STATE_COMPLETED");

    const log = await (await logRoute.GET(new Request(`${base}/api/demo/log?contextId=req_demo_1`))).json();
    const skills = log.entries.map((e: { skillId?: string }) => e.skillId);
    expect(skills).toEqual(expect.arrayContaining(["platform.match_clinics", "clinic.quote", "clinic.book"]));
  }, 30_000);

  it("inject → propose → activate excludes Ara from the next match (10 데모 7·8행)", async () => {
    const injected = await (await injectRoute.POST()).json();
    expect(injected).toEqual({ injected: 20, meanGapPct: 31 });
    const proposal = await (await proposeRoute.POST()).json();
    const ara = proposal.proposed.find((r: { then: { clinicIds?: string[] } }) => r.then.clinicIds?.includes("cln_ara"));
    expect(ara.reason).toContain("+31% (n=20)");
    const activated = await ruleActionRoute.POST(post(), { params: Promise.resolve({ ruleId: ara.id, action: "activate" }) });
    expect(activated.status).toBe(200);

    const match = await sendMessage({
      from: yuki,
      toCardUrl: `${base}/a2a/platform/agent-card.json`,
      skillId: "platform.match_clinics",
      contextId: "req_demo_2",
      fetchImpl: inProcessFetch,
      data: {
        schema: "pibu/procedure-request@1",
        requestId: "req_demo_2",
        customerAgentId: "cag_7f3k2d",
        procedureId: "rejuran_healer",
        amount: { value: 2, unit: "cc" },
        languages: ["ja"],
        dateWindow: { from: "2026-11-13", to: "2026-11-15" },
        visitorProfile: { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true },
      },
    });
    const shortlist = taskArtifactData(match) as { appliedRuleIds: string[]; candidates: { clinicId: string }[] };
    expect(shortlist.candidates.map((c) => c.clinicId)).not.toContain("cln_ara");
    expect(shortlist.appliedRuleIds).toContain(ara.id);
  }, 30_000);
});

describe("demo scenario driver", () => {
  it("runs Yuki over A2A: three quotes with the 07 verdicts, then a booking waiting at Seoul Glow", async () => {
    const { runYukiScenario } = await import("./demo-scenario");
    const result = await runYukiScenario();
    expect(result.quotes.map((q) => q.clinicId).sort()).toEqual(["cln_ara", "cln_mint", "cln_seoul_glow"]);
    const labels = Object.fromEntries(
      (result.verdicts as { quoteId: string; label: string }[]).map((v) => [result.quotes.find((q) => q.quoteId === v.quoteId)!.clinicId, v.label]),
    );
    expect(labels).toEqual({ cln_mint: "underdosed", cln_seoul_glow: "fair", cln_ara: "fair" });
    expect(result.booking?.state).toBe("TASK_STATE_WORKING");
    const confirmed = await (await confirmRoute.POST(post({}))).json();
    expect(confirmed.clinicId).toBe("cln_seoul_glow");

    setClock("2026-11-14T13:00:00+09:00");
    const { submitYukiD0 } = await import("./demo-scenario");
    const d0 = await submitYukiD0();
    expect(d0.steps[0]).toEqual({ step: "platform.submit_outcome", state: "TASK_STATE_COMPLETED" });
    expect(d0.steps[1].step).toBe("platform.anchor_record");
  }, 60_000);
});
