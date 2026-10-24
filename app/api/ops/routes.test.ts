// Route handler tests for app/api/demo/** and app/api/ops/**. Contracts owned by other tracks
// (seed loader, clinic booking confirmation, task completer, session, Claude) are mocked.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ClinicBooking } from "../../../lib/domain/clinic";
import type { ClinicRegistryEntry, Outcome } from "../../../lib/domain/platform";
import type { A2ALogEntry } from "../../../lib/domain/shared";
import type { Store } from "../../../lib/store/types";
import { recordA2ALog } from "../../../lib/a2a/log";
import { clock, resetClock } from "../../../lib/clock";
import { getStore, resetStore } from "../../../lib/store";
import { PLATFORM_COLLECTIONS } from "../../../lib/agents/platform/signals";
import { loadSeed } from "../../../data/seed/load";
import { confirmBooking } from "../../../lib/agents/clinic/booking";
import { taskCompleter } from "../../../lib/a2a/tasks";
import { getSessionUser } from "../../../lib/auth/session";

import { POST as resetPOST } from "../demo/reset/route";
import { GET as clockGET, POST as clockPOST } from "../demo/clock/route";
import { POST as injectPOST } from "../demo/inject-outcomes/route";
import { POST as demoConfirmPOST } from "../demo/confirm-booking/route";
import { GET as statePOSTless } from "../demo/state/route";
import { GET as personasGET } from "../demo/personas/route";
import { GET as clinicsGET } from "./clinics/route";
import { GET as queueGET } from "./proxy-queue/route";
import { POST as queueConfirmPOST } from "./proxy-queue/[bookingId]/confirm/route";
import { POST as queueRejectPOST } from "./proxy-queue/[bookingId]/reject/route";
import { GET as rulesGET } from "./rules/route";
import { POST as proposePOST } from "./rules/propose/route";
import { POST as approvePOST } from "./rules/[id]/approve/route";
import { POST as rejectRulePOST } from "./rules/[id]/reject/route";
import { POST as retirePOST } from "./rules/[id]/retire/route";
import { GET as signalsGET } from "./signals/route";
import { GET as pricesGET } from "./prices/route";
import { GET as logGET } from "./a2a-log/route";

vi.mock("../../../data/seed/load", () => ({ loadSeed: vi.fn() }));
vi.mock("../../../lib/agents/clinic/booking", () => ({ confirmBooking: vi.fn() }));
vi.mock("../../../lib/a2a/tasks", () => ({ taskCompleter: { complete: vi.fn(async () => undefined) } }));
vi.mock("../../../lib/auth/session", () => ({ getSessionUser: vi.fn(async () => null) }));
vi.mock("../../../lib/llm/index", () => ({
  runClaude: vi.fn(async () => {
    throw new Error("llm layer not implemented yet (track LLM)");
  }),
}));

const START = "2026-11-12T10:00:00+09:00";
const ENV = { DEMO_MODE: process.env.DEMO_MODE, DEMO_NOW: process.env.DEMO_NOW };

const req = (path: string, init?: RequestInit) => new Request(`http://localhost${path}`, init);
const post = (path: string, body?: unknown) =>
  req(path, { method: "POST", headers: { "content-type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
const params = <T extends Record<string, string>>(value: T) => ({ params: Promise.resolve(value) });
const body = async (response: Response) => (await response.json()) as Record<string, any>;

function clinic(id: string, area: ClinicRegistryEntry["area"], mode: ClinicRegistryEntry["operationMode"], name: string, lastVerifiedAt: string): ClinicRegistryEntry {
  return {
    id,
    slug: id.slice(4),
    name: { ko: name },
    area,
    agentCardUrl: `http://localhost/a2a/clinics/${id}/agent-card.json`,
    operationMode: mode,
    dataSources: ["sms"],
    lastVerifiedAt,
    foreignPatientFacilityRegistered: true,
    verificationStatus: "verified",
    languages: [{ locale: "ja", mode: "interpreter" }],
  };
}

/** Stand-in for data/seed/load.ts: registry, the two seed rules and Ara's 4 base outcomes. */
async function fakeSeed(store: Store) {
  for (const entry of [
    clinic("cln_seoul_glow", "sinsa", "clinic", "서울글로우의원", "2026-11-05"),
    clinic("cln_mint", "gangnam", "proxy", "민트피부과의원", "2026-10-20"),
    clinic("cln_ara", "apgujeong", "proxy", "아라의원", "2026-10-09"),
  ]) {
    await store.put("platform", PLATFORM_COLLECTIONS.registry, entry);
  }
  await store.put("platform", PLATFORM_COLLECTIONS.rules, {
    id: "rule_001",
    version: 1,
    status: "active",
    when: { nationalities: ["CN"] },
    then: { kind: "require_language", languages: ["zh-CN"] },
    reason: "중국 고객에게는 중국어 응대가 되는 병원만 보여줘요.",
    evidence: { outcomeIds: [], signalIds: [], summary: "운영 정책" },
    source: "operator",
    createdAt: "2026-10-01T10:00:00+09:00",
    activatedAt: "2026-10-01T10:00:00+09:00",
    appliedCount: 9,
  });
  const base = [31, 50, 70, 90].map((days, i): Outcome => {
    const at = new Date(Date.parse(START) - days * 86_400_000).toISOString().replace("Z", "+00:00");
    return {
      schema: "pibu/outcome@1",
      id: `out_ara_base${i}`,
      outcomeId: `out_ara_base${i}`,
      bookingId: `bkg_ara_base${i}`,
      clinicId: "cln_ara",
      procedureId: "rejuran_healer",
      checkpoint: "D0",
      paidKrw: 379_500,
      receivedAmount: { value: 2, unit: "cc" },
      productVerified: "box_shown",
      receiptAttached: true,
      satisfaction: 3,
      painScore: 3,
      downtimeDaysActual: 1,
      wouldReturn: false,
      sideEffects: [],
      visitorProfile: { nationality: "JP", ageBand: "25-29" },
      submittedAt: at,
      receivedAt: at,
      quotedKrw: 330_000,
      quoteGapRatio: 0.15,
    };
  });
  for (const outcome of base) await store.put("platform", PLATFORM_COLLECTIONS.outcomes, outcome);
  return { loaded: { clinic_registry: 3, routing_rules: 1, outcomes: 4 } };
}

function logEntry(partial: Partial<A2ALogEntry> & Pick<A2ALogEntry, "id" | "at" | "skillId">): A2ALogEntry {
  return {
    contextId: "req_01J9Z5",
    from: { agentId: "cag_4d8p7", role: "customer" },
    to: { agentId: "cln_ara", role: "clinic", url: "http://localhost/a2a/clinics/ara/rpc" },
    method: "SendMessage",
    request: {},
    humanSummary: { ko: "호출" },
    ...partial,
  };
}

/** A proxy booking waiting at Ara, with the quote and book calls that produced it in the shared log. */
async function seedProxyBooking(store: Store, id = "bkg_0090") {
  await recordA2ALog(
    store,
    logEntry({
      id: "log_q1",
      at: "2026-11-12T09:51:30+09:00",
      skillId: "clinic.quote",
      taskId: "tsk_q1",
      response: {
        jsonrpc: "2.0",
        id: 1,
        result: {
          task: {
            id: "tsk_q1",
            contextId: "req_01J9Z5",
            status: { state: "TASK_STATE_COMPLETED" },
            artifacts: [{ artifactId: "a1", parts: [{ data: { schema: "pibu/quote@1", quoteId: "qt_1199", procedureId: "rejuran_healer", amount: { value: 2, unit: "cc" }, priceKrw: 300_000, vatIncluded: false } }] }],
          },
        },
      },
      state: "TASK_STATE_COMPLETED",
    }),
  );
  await recordA2ALog(
    store,
    logEntry({
      id: "log_b1",
      at: "2026-11-12T09:52:08+09:00",
      skillId: "clinic.book",
      taskId: "tsk_b1",
      request: { params: { message: { parts: [{ data: { schema: "pibu/booking-request@1", guest: { displayName: "Mika S.", contactHandle: "mika_line" }, safetyInfo: { allergies: ["lidocaine"] } } }] } } },
      state: "TASK_STATE_WORKING",
    }),
  );
  const booking: ClinicBooking = {
    id,
    clinicId: "cln_ara",
    a2aTaskId: "tsk_b1",
    request: {
      schema: "pibu/booking-request@1",
      requestId: "req_01J9Z5",
      quoteId: "qt_1199",
      clinicId: "cln_ara",
      slot: "2026-11-14T15:00:00+09:00",
      guest: { displayName: "Mika S.", contactChannel: "line", contactHandle: "mika_line", language: "ja" },
      consentRef: "cns_0001",
    },
    status: "pending_clinic",
    referralJti: "jti_1",
  };
  await store.put("clinic", "bookings", booking);
  return booking;
}

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  process.env.DEMO_NOW = START;
  resetStore();
  resetClock();
  vi.mocked(loadSeed).mockReset().mockImplementation(fakeSeed);
  vi.mocked(confirmBooking).mockReset().mockImplementation(async (_clinicId, bookingId, by) => ({ bookingId, status: "confirmed", confirmedBy: by }));
  vi.mocked(taskCompleter.complete).mockClear();
  vi.mocked(getSessionUser).mockReset().mockResolvedValue(null);
});

afterEach(() => {
  for (const [key, value] of Object.entries(ENV)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetStore();
  resetClock();
});

describe("demo routes", () => {
  it("reset clears the store, puts the clock back and loads the seed", async () => {
    await getStore().put("platform", PLATFORM_COLLECTIONS.outcomes, { id: "out_stray" });
    await clockPOST(post("/api/demo/clock", { to: "2026-11-20T10:00:00+09:00" }));
    const response = await resetPOST();
    expect(response.status).toBe(200);
    expect(await body(response)).toMatchObject({ ok: true, now: START, loaded: { clinic_registry: 3 } });
    expect(loadSeed).toHaveBeenCalledWith(getStore());
    expect(await getStore().get("platform", PLATFORM_COLLECTIONS.outcomes, "out_stray")).toBeUndefined();
    expect(await getStore().list("platform", PLATFORM_COLLECTIONS.outcomes)).toHaveLength(4);
  });

  it("reset reports a seed loader failure instead of pretending, after clearing the store", async () => {
    vi.mocked(loadSeed).mockRejectedValueOnce(new Error("seed loader not implemented yet (track A2A core)"));
    await getStore().put("platform", PLATFORM_COLLECTIONS.outcomes, { id: "out_stray" });
    const response = await resetPOST();
    expect(response.status).toBe(500);
    expect((await body(response)).error.code).toBe("seed_load_failed");
    expect(await getStore().list("platform", PLATFORM_COLLECTIONS.outcomes)).toHaveLength(0);
  });

  it("clock moves the fixed demo clock forward and back, and rejects a time without offset", async () => {
    const moved = await clockPOST(post("/api/demo/clock", { to: "2026-11-14T13:00:00+09:00" }));
    expect(await body(moved)).toEqual({ now: "2026-11-14T13:00:00+09:00", today: "2026-11-14" });
    expect(clock.nowIso()).toBe("2026-11-14T13:00:00+09:00");
    expect(await body(await clockGET())).toMatchObject({ now: "2026-11-14T13:00:00+09:00" });
    expect((await clockPOST(post("/api/demo/clock", { to: "2026-11-14 13:00" }))).status).toBe(400);
    expect(await body(await clockPOST(post("/api/demo/clock", { reset: true })))).toMatchObject({ now: START });
  });

  it("inject writes 20 Ara outcomes dated 1 to 29 days before the clock with mean gap exactly 0.31", async () => {
    await clockPOST(post("/api/demo/clock", { to: "2026-11-14T13:00:00+09:00" }));
    const result = await body(await injectPOST());
    expect(result).toMatchObject({ injected: 20, meanGapPct: 31, source: "builtin" });
    expect(Math.abs(result.meanGap - 0.31)).toBeLessThan(1e-9);
    const now = Date.parse("2026-11-14T13:00:00+09:00");
    const outcomes = await getStore().list<Outcome>("platform", PLATFORM_COLLECTIONS.outcomes);
    expect(outcomes).toHaveLength(20);
    for (const outcome of outcomes) {
      const days = (now - Date.parse(outcome.submittedAt)) / 86_400_000;
      expect(days).toBeGreaterThanOrEqual(1);
      expect(days).toBeLessThanOrEqual(29);
    }
    expect((await body(await statePOSTless())).injected).toBe(20);
  });

  it("confirm-booking calls confirmBooking as the operator for a proxy clinic", async () => {
    await fakeSeed(getStore());
    await seedProxyBooking(getStore());
    const result = await body(await demoConfirmPOST(post("/api/demo/confirm-booking", {})));
    expect(confirmBooking).toHaveBeenCalledWith("cln_ara", "bkg_0090", "pibu_operator");
    expect(result).toMatchObject({ bookingId: "bkg_0090", operationMode: "proxy", confirmedBy: "pibu_operator" });
  });

  it("confirm-booking calls confirmBooking as clinic staff for a direct clinic", async () => {
    await fakeSeed(getStore());
    const booking = await seedProxyBooking(getStore(), "bkg_0091");
    await getStore().put("clinic", "bookings", { ...booking, clinicId: "cln_seoul_glow" });
    await demoConfirmPOST(post("/api/demo/confirm-booking", { bookingId: "bkg_0091" }));
    expect(confirmBooking).toHaveBeenCalledWith("cln_seoul_glow", "bkg_0091", "clinic_staff");
  });

  it("demo endpoints are a 404 outside DEMO_MODE", async () => {
    process.env.DEMO_MODE = "false";
    for (const response of [await resetPOST(), await injectPOST(), await clockGET(), await personasGET(), await statePOSTless()]) {
      expect(response.status).toBe(404);
    }
    expect(loadSeed).not.toHaveBeenCalled();
  });

  it("personas lists the four customers, the clinic account and the operator with their start screens", async () => {
    const { personas } = await body(await personasGET());
    expect(personas.map((p: { id: string }) => p.id)).toEqual(["yuki", "lin", "emily", "jisoo", "clinic", "operator"]);
    expect(personas[0]).toMatchObject({ kind: "customer", locale: "ja", path: "/ja/onboarding" });
  });
});

describe("ops proxy queue", () => {
  it("lists the waiting proxy booking with quote details from the log, without contact details", async () => {
    await fakeSeed(getStore());
    await seedProxyBooking(getStore());
    const result = await body(await queueGET(req("/api/ops/proxy-queue")));
    expect(result.waiting).toHaveLength(1);
    expect(result.waiting[0]).toMatchObject({
      bookingId: "bkg_0090",
      clinicName: "아라의원",
      guest: { displayName: "Mika S.", language: "ja", agentId: "cag_4d8p7" },
      quote: { procedureId: "rejuran_healer", priceKrw: 300_000, vatIncluded: false },
      procedureName: "리쥬란",
      requestedAt: "2026-11-12T09:52:08+09:00",
    });
    expect(JSON.stringify(result)).not.toContain("mika_line");
  });

  it("confirm calls confirmBooking with by=pibu_operator", async () => {
    await fakeSeed(getStore());
    await seedProxyBooking(getStore());
    const response = await queueConfirmPOST(post("/api/ops/proxy-queue/bkg_0090/confirm"), params({ bookingId: "bkg_0090" }));
    expect(response.status).toBe(200);
    expect(confirmBooking).toHaveBeenCalledTimes(1);
    expect(confirmBooking).toHaveBeenCalledWith("cln_ara", "bkg_0090", "pibu_operator");
    expect((await body(response)).result).toEqual({ bookingId: "bkg_0090", status: "confirmed", confirmedBy: "pibu_operator" });
  });

  it("confirm refuses a direct clinic's booking and an unknown id", async () => {
    await fakeSeed(getStore());
    const booking = await seedProxyBooking(getStore());
    await getStore().put("clinic", "bookings", { ...booking, clinicId: "cln_seoul_glow" });
    expect((await queueConfirmPOST(post("/x"), params({ bookingId: "bkg_0090" }))).status).toBe(409);
    expect((await queueConfirmPOST(post("/x"), params({ bookingId: "bkg_nope" }))).status).toBe(404);
    expect(confirmBooking).not.toHaveBeenCalled();
  });

  it("reject finishes the clinic.book task as REJECTED and cancels the booking", async () => {
    await fakeSeed(getStore());
    await seedProxyBooking(getStore());
    const response = await queueRejectPOST(post("/x", { reason: "해당 시간 예약 마감" }), params({ bookingId: "bkg_0090" }));
    expect(response.status).toBe(200);
    expect(taskCompleter.complete).toHaveBeenCalledWith({ role: "clinic", agentId: "cln_ara" }, "tsk_b1", { state: "TASK_STATE_REJECTED", text: "해당 시간 예약 마감" });
    expect(await getStore().get<ClinicBooking>("clinic", "bookings", "bkg_0090")).toMatchObject({ status: "canceled" });
    expect(confirmBooking).not.toHaveBeenCalled();
  });
});

describe("ops auth", () => {
  it("outside DEMO_MODE a signed-out request is 401 and a customer is 403; an operator gets through", async () => {
    process.env.DEMO_MODE = "false";
    expect((await clinicsGET(req("/api/ops/clinics"))).status).toBe(401);
    vi.mocked(getSessionUser).mockResolvedValue({ id: "u1", email: "a@b.c", name: null, customerAgentId: "cag_1", role: "customer" });
    expect((await clinicsGET(req("/api/ops/clinics"))).status).toBe(403);
    vi.mocked(getSessionUser).mockResolvedValue({ id: "op_kim", email: "o@b.c", name: "Kim", customerAgentId: "cag_2", role: "operator" });
    expect((await clinicsGET(req("/api/ops/clinics"))).status).toBe(200);
  });

  it("in DEMO_MODE a signed-out request is allowed and acts as demo_operator", async () => {
    await fakeSeed(getStore());
    await getStore().put("platform", PLATFORM_COLLECTIONS.rules, {
      id: "rule_005", version: 1, status: "proposed", when: {}, then: { kind: "require_language", languages: ["ja"] },
      reason: "r", evidence: { outcomeIds: [], signalIds: [], summary: "s" }, source: "operator", createdAt: START, appliedCount: 0,
    });
    const approved = await body(await approvePOST(post("/x"), params({ id: "rule_005" })));
    expect(approved.rule.approvedBy).toBe("demo_operator");
  });
});

describe("ops improvement loop (demo scenario rows 7 and 8)", () => {
  it("reset, inject, propose, approve: the Ara exclusion for JP becomes active and versioned", async () => {
    await resetPOST();
    // before the burst the proposer finds nothing
    const before = await body(await proposePOST(post("/api/ops/rules/propose")));
    expect(before.proposed).toEqual([]);
    expect(before.mode).toBe("template");

    await injectPOST();
    const run = await body(await proposePOST(post("/api/ops/rules/propose")));
    expect(run.proposed).toHaveLength(1);
    const proposal = run.proposed[0];
    expect(proposal).toMatchObject({
      id: "rule_002",
      status: "proposed",
      version: 1,
      when: { nationalities: ["JP"] },
      then: { kind: "exclude_clinic", clinicIds: ["cln_ara"] },
      evidence: { summary: "최근 30일 견적 대비 실결제 평균 +31% (n=20)" },
    });
    expect(run.clinics.cln_ara).toBe("아라의원");

    const proposedList = await body(await rulesGET(req("/api/ops/rules?status=proposed")));
    expect(proposedList.rules.map((r: { id: string }) => r.id)).toEqual(["rule_002"]);

    const approved = await body(await approvePOST(post("/x"), params({ id: "rule_002" })));
    expect(approved.rule).toMatchObject({ status: "active", version: 2, activatedAt: START, expiresAt: "2027-02-10T10:00:00+09:00", daysToExpiry: 90, reviewDue: false });

    const active = await body(await rulesGET(req("/api/ops/rules?status=active")));
    expect(active.rules.map((r: { id: string }) => r.id)).toEqual(["rule_001", "rule_002"]);
    expect(active.rules[1].history.map((h: { version: number; event: string }) => [h.version, h.event])).toEqual([
      [1, "proposed"],
      [2, "approved"],
    ]);
    expect(active.counts).toEqual({ proposed: 0, active: 2, rejected: 0, retired: 0 });

    // a second approve is a conflict; retire then works and bumps the version again
    expect((await approvePOST(post("/x"), params({ id: "rule_002" }))).status).toBe(409);
    const retired = await body(await retirePOST(post("/x"), params({ id: "rule_002" })));
    expect(retired.rule).toMatchObject({ status: "retired", version: 3 });
    expect((await rejectRulePOST(post("/x"), params({ id: "rule_404" }))).status).toBe(404);
  });

  it("signals, prices and clinics views read the same store", async () => {
    await resetPOST();
    await injectPOST();
    const signals = await body(await signalsGET(req("/api/ops/signals")));
    const ara = signals.clinics.find((c: { clinicId: string }) => c.clinicId === "cln_ara");
    expect(ara).toMatchObject({ outcomes: 20, gapN: 20 });
    expect(Math.round(ara.meanGap * 100)).toBe(31);
    expect(signals.segments).toEqual([expect.objectContaining({ clinicId: "cln_ara", nationality: "JP", n: 20 })]);

    expect((await body(await pricesGET(req("/api/ops/prices")))).bands).toEqual([]);

    const clinics = await body(await clinicsGET(req("/api/ops/clinics")));
    expect(clinics.today).toBe("2026-11-12");
    const byId = Object.fromEntries(clinics.clinics.map((c: { id: string }) => [c.id, c]));
    expect(byId.cln_ara).toMatchObject({ daysSinceVerified: 34, stale: true, displayName: "아라의원" });
    expect(byId.cln_seoul_glow).toMatchObject({ daysSinceVerified: 7, stale: false });
  });
});

describe("ops a2a log", () => {
  it("filters by agent, skill, state and contextId and never returns sensitive values", async () => {
    await fakeSeed(getStore());
    await seedProxyBooking(getStore());
    const all = await body(await logGET(req("/api/ops/a2a-log")));
    expect(all.total).toBe(2);
    expect(JSON.stringify(all)).not.toContain("lidocaine");
    expect(JSON.stringify(all)).not.toContain("mika_line");
    expect(all.facets.skills).toEqual(["clinic.book", "clinic.quote"]);

    const book = await body(await logGET(req("/api/ops/a2a-log?skill=clinic.book")));
    expect(book.entries.map((e: { id: string }) => e.id)).toEqual(["log_b1"]);
    const working = await body(await logGET(req("/api/ops/a2a-log?state=TASK_STATE_WORKING&agent=role:clinic")));
    expect(working.entries.map((e: { id: string }) => e.id)).toEqual(["log_b1"]);
    expect((await body(await logGET(req("/api/ops/a2a-log?contextId=j9z5")))).entries).toHaveLength(2);
    expect((await body(await logGET(req("/api/ops/a2a-log?agent=cln_mint")))).entries).toHaveLength(0);
    expect((await body(await logGET(req("/api/ops/a2a-log?after=log_q1")))).entries.map((e: { id: string }) => e.id)).toEqual(["log_b1"]);
  });
});
