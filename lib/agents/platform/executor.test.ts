import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { routeFetch } from "../../a2a/__fixtures__/route-fetch";
import { sendMessage, type AgentRef } from "../../a2a/client";
import { listA2ALog } from "../../a2a/log";
import { PIBU_SCHEMAS, type SkillId } from "../../a2a/schemas";
import { taskArtifactData } from "../../a2a/wire";
import { getStore } from "../../store";
import { TEST_BASE, setupPlatformTest, teardownPlatformTest } from "./__fixtures__/offer-cache";
import { YUKI_AGENT, yukiRequest } from "./__fixtures__/requests";
import { platformStore } from "./store";

beforeEach(setupPlatformTest);
afterEach(teardownPlatformTest);

const PLATFORM_CARD = `${TEST_BASE}/a2a/platform/agent-card.json`;
const yuki: AgentRef = { agentId: YUKI_AGENT, role: "customer" };

const call = (skillId: SkillId, data: Record<string, unknown>, from: AgentRef = yuki) =>
  sendMessage({ from, toCardUrl: PLATFORM_CARD, skillId, data, contextId: "req_yuki_t1", fetchImpl: routeFetch });

describe("platform executor over A2A", () => {
  it("answers platform.match_clinics with a COMPLETED task carrying pibu/clinic-shortlist@1, logged once", async () => {
    const task = await call("platform.match_clinics", yukiRequest());
    expect(task.status.state).toBe("TASK_STATE_COMPLETED");
    const data = taskArtifactData(task);
    expect(data?.schema).toBe("pibu/clinic-shortlist@1");
    const shortlist = PIBU_SCHEMAS["pibu/clinic-shortlist@1"].parse(data);
    expect(shortlist.candidates.map((c) => c.clinicId)).toEqual(["cln_seoul_glow", "cln_mint", "cln_ara"]);

    const log = await listA2ALog(getStore());
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ skillId: "platform.match_clinics", state: "TASK_STATE_COMPLETED", from: { agentId: YUKI_AGENT } });
  });

  it("rejects an ineligible visitor with the reason in status.message", async () => {
    const task = await call("platform.match_clinics", yukiRequest({ visitorProfile: { nationality: "JP", residency: "resident", ageBand: "25-29" } }));
    expect(task.status.state).toBe("TASK_STATE_REJECTED");
    expect(task.status.message?.parts[0].text).toBe("not_eligible_foreign_patient");
    expect(task.artifacts ?? []).toEqual([]);
  });

  it("rejects a match asked for another customer agent", async () => {
    const task = await call("platform.match_clinics", yukiRequest(), { agentId: "cag_2m8x9", role: "customer" });
    expect(task.status.state).toBe("TASK_STATE_REJECTED");
    expect(task.status.message?.parts[0].text).toBe("customer_agent_mismatch");
  });

  it("answers platform.recipe and platform.judge_quote with their data schemas", async () => {
    const recipe = await call("platform.recipe", { schema: "pibu/recipe-query@1", concerns: ["elasticity"], ageBand: "25-29" });
    expect(recipe.status.state).toBe("TASK_STATE_COMPLETED");
    expect(PIBU_SCHEMAS["pibu/recipe@1"].safeParse(taskArtifactData(recipe)).success).toBe(true);

    const judged = await call("platform.judge_quote", {
      schema: "pibu/judge-request@1",
      requestId: "req_yuki_t1",
      matchId: "mt_t1",
      quotes: [{ quoteId: "qt_88a1", clinicId: "cln_mint", procedureId: "rejuran_healer", amount: { value: 1, unit: "cc" }, priceKrw: 99_000, vatIncluded: true, includes: ["numbing_cream"] }],
    });
    const verdicts = PIBU_SCHEMAS["pibu/fairness-verdict-list@1"].parse(taskArtifactData(judged));
    expect(verdicts.verdicts[0]).toMatchObject({ quoteId: "qt_88a1", label: "underdosed", priceBand: "low", sampleSize: 42 });
  });

  it("answers platform.report_signal with a text confirmation", async () => {
    await call("platform.match_clinics", yukiRequest());
    const task = await call("platform.report_signal", {
      schema: "pibu/signal-report@1",
      clinicId: "cln_mint",
      kind: "response_timeout",
      taskId: "tsk_k2_0001",
      requestId: "req_yuki_t1",
      at: "2026-11-12T10:00:21+09:00",
    });
    expect(task.status.state).toBe("TASK_STATE_COMPLETED");
    expect(task.artifacts?.[0].parts[0].text).toBe("signal response_timeout recorded for cln_mint");
    const timeouts = (await platformStore.signals()).filter((s) => s.kind === "response_timeout");
    expect(timeouts).toHaveLength(1);
    expect(timeouts[0]).toMatchObject({
      clinicId: "cln_mint",
      value: 1,
      context: { taskId: "tsk_k2_0001", nationality: "JP", procedureId: "rejuran_healer" },
      at: "2026-11-12T10:00:21+09:00",
    });
  });
});
