import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { agentUrls } from "../../a2a/cards";
import { clinicBookingIdForTask, confirmClinicBooking } from "../../a2a/__fixtures__/clinic-admin";
import { routeFetch } from "../../a2a/__fixtures__/route-fetch";
import { sendMessage } from "../../a2a/client";
import { taskArtifactData } from "../../a2a/wire";
import { PLATFORM_AGENT_ID } from "../../store";
import { proveOffer, verifyOffer } from "../../zk/client";
import { bookQuote, pollBooking } from "./booking";
import { getRequestView, runRequest } from "./orchestrator";
import { customerStore } from "./store";
import { YUKI, bundleFor, catalog, draftYuki, setupCustomerTest, teardownCustomerTest } from "./__fixtures__/setup";

// The customer agent's two skills over the real rpc route (02 1절 "A2A 스킬"): customer.notify stores the
// notification, customer.checkin asks the customer (INPUT_REQUIRED) and completes with pibu/outcome@1.

vi.mock("../../zk/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../zk/client")>()),
  proveOffer: vi.fn(),
  verifyOffer: vi.fn(),
}));

beforeEach(async () => {
  await setupCustomerTest();
  vi.mocked(proveOffer).mockReset().mockImplementation(async (persona, offerId) => bundleFor(persona, offerId));
  vi.mocked(verifyOffer).mockReset().mockResolvedValue({ ok: true, reason: "verified" });
});
afterEach(teardownCustomerTest);

const PLATFORM = { agentId: PLATFORM_AGENT_ID, role: "platform" as const };
const FAST = { fetchImpl: routeFetch, pollIntervalMs: 5, pollTimeoutMs: 3_000 } as const;

const toYuki = (skillId: "customer.notify" | "customer.checkin", data: Record<string, unknown>, extra: { taskId?: string; contextId?: string } = {}) =>
  sendMessage({ from: PLATFORM, toCardUrl: agentUrls.customer(YUKI.agentId).card, skillId, data, contextId: extra.contextId ?? "ctx_test", fetchImpl: routeFetch, ...(extra.taskId ? { taskId: extra.taskId } : {}) });

/** Yuki's Seoul Glow booking, confirmed by the clinic and seen by the agent's poll. */
async function confirmedBooking() {
  const draft = await draftYuki();
  await runRequest(draft.id, { fetchImpl: routeFetch, offerCatalog: catalog });
  const quote = (await getRequestView(draft.id))!.quotes.find((q) => q.quote.clinicId === "cln_seoul_glow")!;
  const booking = await bookQuote(draft.id, quote.id, "2026-11-14T11:00:00+09:00", { ...FAST, poll: "none" });
  await confirmClinicBooking(await clinicBookingIdForTask(booking.clinicId, booking.clinicTaskId), { fetchImpl: routeFetch });
  return pollBooking(booking.id, FAST);
}

describe("customer.notify", () => {
  it("stores the notification for Yuki and completes", async () => {
    const task = await toYuki("customer.notify", { schema: "pibu/notification@1", kind: "reminder", text: { ja: "明日11:00の予約です" } });
    expect(task.status.state).toBe("TASK_STATE_COMPLETED");
    const stored = await customerStore.notifications(YUKI.customerId);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ kind: "reminder", from: { role: "platform" }, text: { ja: "明日11:00の予約です" } });
  });
});

describe("customer.checkin", () => {
  it("fails for a booking that is not Yuki's", async () => {
    const task = await toYuki("customer.checkin", { schema: "pibu/checkin-request@1", bookingId: "bkg_nobody", checkpoint: "D7", questions: ["腫れは引きましたか"] });
    expect(task.status.state).toBe("TASK_STATE_FAILED");
  });

  it("asks the customer, re-asks a missing satisfaction, then completes with the outcome on the same task", async () => {
    const booking = await confirmedBooking();
    const bookingId = booking.booking!.bookingId;
    const asked = await toYuki("customer.checkin", { schema: "pibu/checkin-request@1", bookingId, checkpoint: "D7", questions: ["腫れは引きましたか"] }, { contextId: booking.requestId });
    expect(asked.status.state).toBe("TASK_STATE_INPUT_REQUIRED");

    const again = await toYuki("customer.checkin", { schema: "pibu/input-response@1", values: { q1: "はい" } }, { taskId: asked.id, contextId: booking.requestId });
    expect(again.status.state).toBe("TASK_STATE_INPUT_REQUIRED");

    const done = await toYuki("customer.checkin", { schema: "pibu/input-response@1", values: { q1: "はい", satisfaction: "4" } }, { taskId: asked.id, contextId: booking.requestId });
    expect(done.status.state).toBe("TASK_STATE_COMPLETED");
    expect(taskArtifactData(done)).toMatchObject({ schema: "pibu/outcome@1", bookingId, checkpoint: "D7", satisfaction: 4, clinicId: "cln_seoul_glow", comment: "腫れは引きましたか はい" });
  });
});
