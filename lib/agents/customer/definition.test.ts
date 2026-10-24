import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillContext } from "../../a2a/contract";
import { parsePibuData } from "../../a2a/schemas";
import { resetClock, setClock } from "../../clock";
import { getStore, resetStore } from "../../store";
import { checkinSkill, customerAgent, customerCard, notifySkill } from "./definition";
import { inboxOf } from "./inbox";
import { createMockA2A, MOCK_BASE_URL } from "./mock-a2a";
import { answerCheckin, bookQuote, createDraft, defaultDeps, pollBooking, runRequest, submitOutcome } from "./orchestrator";
import { ensureDemoCustomer } from "./seed";
import { C, listOf, type InboxItem } from "./store";

const ctx = (role: "clinic" | "platform" | "customer", overrides: Partial<SkillContext> = {}): SkillContext => ({
  caller: { role, agentId: role === "clinic" ? "cln_seoul_glow" : role === "platform" ? "platform" : "cag_other" },
  self: { role: "customer", agentId: "cag_7f3k2" },
  taskId: "tsk_c_0001",
  contextId: "req_01J9Z8",
  metadata: {},
  ...overrides,
});

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  setClock("2026-11-13T09:00:00+09:00");
  resetStore();
});

afterEach(() => {
  resetClock();
  vi.unstubAllEnvs();
});

describe("customer agent card and existence", () => {
  it("builds a per-customer card with the two customer skills and the consent extension", async () => {
    const card = customerCard("cag_7f3k2", "https://pibu.example");
    expect(card.supportedInterfaces).toEqual([{ url: "https://pibu.example/a2a/customers/cag_7f3k2/rpc", protocolBinding: "JSONRPC", protocolVersion: "1.0" }]);
    expect((card.skills as { id: string }[]).map((s) => s.id)).toEqual(["customer.notify", "customer.checkin"]);
    expect(JSON.stringify(card.capabilities)).toContain("https://pibu.app/ext/consent/v1");
    expect(card.securityRequirements).toEqual([{ schemes: { pibuBearer: { list: [] } } }]);
    expect(await customerAgent.card("cag_7f3k2", "https://pibu.example")).toEqual(card);
    expect(Object.keys(customerAgent.skills).sort()).toEqual(["customer.checkin", "customer.notify"]);
  });

  it("exists only for known customer agent ids", async () => {
    expect(await customerAgent.exists("cag_7f3k2")).toBe(true);
    expect(await customerAgent.exists("cag_nobody")).toBe(false);
  });
});

describe("customer.notify", () => {
  const notification = { schema: "pibu/notification@1", kind: "reminder", bookingId: "bkg_5521", text: { ja: "明日11:00にお待ちしています", en: "See you tomorrow at 11:00" } };

  it("stores a clinic's notification in the customer's inbox and acknowledges with text", async () => {
    expect(parsePibuData("customer.notify", notification).ok).toBe(true);
    const result = await notifySkill(notification, ctx("clinic"));
    expect(result).toEqual({ state: "TASK_STATE_COMPLETED", text: "Notification received." });
    const { due } = await inboxOf(getStore(), "cus_yuki_done");
    expect(due).toHaveLength(1);
    expect(due[0]).toMatchObject({ kind: "reminder", bookingId: "bkg_5521", text: notification.text, from: { role: "clinic", agentId: "cln_seoul_glow" }, status: "open" });
  });

  it("rejects notifications from other customers and for unknown agents", async () => {
    expect((await notifySkill(notification, ctx("customer"))).state).toBe("TASK_STATE_REJECTED");
    expect((await notifySkill(notification, ctx("platform", { self: { role: "customer", agentId: "cag_nobody" } }))).state).toBe("TASK_STATE_REJECTED");
    expect((await inboxOf(getStore(), "cus_yuki_done")).due).toHaveLength(0);
  });
});

describe("customer.checkin (P1)", () => {
  const checkin = { schema: "pibu/checkin-request@1", bookingId: "bkg_5521", checkpoint: "D7", questions: ["Did the paid price differ from the quote?"] };

  it("waits in INPUT_REQUIRED for the customer and refuses non platform callers", async () => {
    expect((await checkinSkill(checkin, ctx("clinic"))).state).toBe("TASK_STATE_REJECTED");
    const result = await checkinSkill(checkin, ctx("platform"));
    expect(result.state).toBe("TASK_STATE_INPUT_REQUIRED");
    expect(result.inputRequest).toEqual({ schema: "pibu/input-request@1", fields: [{ key: "q1", label: { en: "Did the paid price differ from the quote?" }, sensitive: false }] });
    const items = await listOf<InboxItem>(getStore(), C.inbox, { customerId: "cus_yuki_done" });
    expect(items[0]).toMatchObject({ kind: "checkin_request", taskId: "tsk_c_0001", checkpoint: "D7", status: "open" });
  });

  it("completes the platform's task with pibu/outcome@1 once the customer answers", async () => {
    const mock = createMockA2A();
    const completer = { complete: vi.fn(async () => undefined) };
    await ensureDemoCustomer(getStore(), "cus_yuki_done");
    const deps = defaultDeps({ store: getStore(), baseUrl: MOCK_BASE_URL, send: mock.send, get: mock.get, completer, sleep: async () => undefined });
    const draft = await createDraft(deps, "cus_yuki_done", { procedureId: "rejuran_healer" }, "rejuran");
    await runRequest(deps, "cus_yuki_done", draft.id);
    const booking = await bookQuote(deps, "cus_yuki_done", { requestId: draft.id, quoteId: "qt_1203", slot: "2026-11-14T11:00:00+09:00" });
    await pollBooking(deps, "cus_yuki_done", booking.id);
    await submitOutcome(deps, "cus_yuki_done", booking.id, { paidKrw: 340000, receivedAmount: { value: 2, unit: "cc" }, productVerified: "vial_shown", satisfaction: 5, painScore: 3, wouldReturn: true });

    await checkinSkill(checkin, ctx("platform", { taskId: "tsk_pl_checkin" }));
    const item = (await listOf<InboxItem>(getStore(), C.inbox, { customerId: "cus_yuki_done" })).find((i) => i.kind === "checkin_request");
    await answerCheckin(deps, "cus_yuki_done", item!.id, { satisfaction: 4, downtimeDaysActual: 1, wouldReturn: true });
    expect(completer.complete).toHaveBeenCalledTimes(1);
    const [self, taskId, result] = completer.complete.mock.calls[0] as unknown as [unknown, string, { state: string; data: Record<string, unknown> }];
    expect(self).toEqual({ role: "customer", agentId: "cag_7f3k2" });
    expect(taskId).toBe("tsk_pl_checkin");
    expect(result.state).toBe("TASK_STATE_COMPLETED");
    expect(result.data).toMatchObject({ schema: "pibu/outcome@1", checkpoint: "D7", bookingId: "bkg_5521", downtimeDaysActual: 1 });
  });
});
