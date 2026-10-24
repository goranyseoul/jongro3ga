import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cardUrl, sendMessage } from "../../a2a/client";
import type { AgentRef } from "../../a2a/contract";
import { BASE, dispatch, setupA2ATest, teardownA2ATest } from "../../a2a/testing/harness";
import { getStore } from "../../store";
import { inboxOf } from "./inbox";

// The real customer agent behind the real routes (app/a2a/customers/[agentId]), not the test double the
// platform tests use: a clinic notifies Yuki over A2A and the notice lands in her inbox.

const GLOW: AgentRef = { role: "clinic", agentId: "cln_seoul_glow" };
const YUKI_CARD = cardUrl(BASE, { role: "customer", agentId: "cag_7f3k2" });

beforeEach(() => setupA2ATest());
afterEach(() => teardownA2ATest());

describe("customer agent over A2A routes", () => {
  it("keeps the card behind a bearer token", async () => {
    const res = await dispatch(new Request(`${BASE}/a2a/customers/cag_7f3k2/agent-card.json`));
    expect(res.status).toBe(401);
  });

  it("completes customer.notify from a clinic and stores it in the inbox", async () => {
    const notification = { schema: "pibu/notification@1", kind: "reminder", bookingId: "bkg_5521", text: { ja: "明日11:00にお待ちしています", en: "See you tomorrow at 11:00" } };
    const task = await sendMessage({ from: GLOW, toCardUrl: YUKI_CARD, skillId: "customer.notify", data: notification, contextId: "req_yuki01" });
    expect(task.status?.state).toBe("TASK_STATE_COMPLETED");
    const { due } = await inboxOf(getStore(), "cus_yuki_done");
    expect(due[0]).toMatchObject({ kind: "reminder", bookingId: "bkg_5521", from: { role: "clinic", agentId: "cln_seoul_glow" } });
  });
});
