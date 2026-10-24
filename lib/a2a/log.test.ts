import { beforeEach, describe, expect, it } from "vitest";
import type { A2ALogEntry } from "../domain";
import { createMemoryStore, type MemoryStore } from "../store/memory";
import { wireFixtures } from "./__fixtures__/wire";
import { agentTimeline, listA2ALog, recordA2ALog } from "./log";
import { MASK } from "./mask";
import { buildSendMessageRequest } from "./wire";

const customer = { agentId: "cag_7f3k2", role: "customer" as const };
const platform = { agentId: "agt_platform", role: "platform" as const };
const clinic = (slug: string) => ({ agentId: `cln_${slug}`, role: "clinic" as const, url: `https://pibu.example/a2a/clinics/${slug}/rpc` });

const entry = (patch: Partial<A2ALogEntry> & Pick<A2ALogEntry, "id" | "at">): A2ALogEntry => ({
  contextId: "req_01J9Z8",
  from: customer,
  to: { ...platform, url: "https://pibu.example/a2a/platform/rpc" },
  method: "SendMessage",
  skillId: "platform.match_clinics",
  request: { jsonrpc: "2.0", id: "r" },
  state: "TASK_STATE_COMPLETED",
  humanSummary: { ko: "조건에 맞는 병원을 찾았어요" },
  ...patch,
});

let store: MemoryStore;

beforeEach(() => {
  store = createMemoryStore();
});

describe("recordA2ALog", () => {
  it("masks request and response before storing and leaves the caller's objects alone", async () => {
    const bookingData = structuredClone(wireFixtures.find((f) => f.name === "pibu/booking-request@1")!.data);
    const request = buildSendMessageRequest({
      rpcId: "rpc_1",
      messageId: "msg_1",
      contextId: "req_01J9Z8",
      skillId: "clinic.book",
      data: bookingData,
    });
    const response = { result: { echoed: { passportName: "YUKI TANAKA" } } };
    const original = entry({ id: "log_1", at: "2026-11-12T10:00:01+09:00", skillId: "clinic.book", request, response });

    const stored = await recordA2ALog(store, original);

    const persisted = JSON.stringify(await store.get(  "shared", "a2a_log", "log_1"));
    expect(persisted).not.toContain("yuki_demo");
    expect(persisted).not.toContain("YUKI TANAKA");
    expect(persisted).toContain(MASK);
    expect(JSON.stringify(stored)).toBe(persisted);
    expect(JSON.stringify(original.request)).toContain("yuki_demo");
  });

  it("compacts long proofs in the stored entry and leaves the caller's object untouched", async () => {
    const long = "0x" + "ab".repeat(14000);
    const request = { metadata: { offerProof: { proofs: [{ proof: long, publicInputs: ["1"] }] } } };
    const stored = await recordA2ALog(store, entry({ id: "log_p", at: "2026-11-12T10:00:00+09:00", request }));
    const persisted = (await store.get("shared", "a2a_log", "log_p")) as A2ALogEntry;
    expect(JSON.stringify(persisted)).not.toContain(long);
    expect(JSON.stringify(stored.request)).toContain("[proof 14.0KB]");
    expect(request.metadata.offerProof.proofs[0]!.proof).toBe(long);
  });

  it("applies extra masked fields and replaces an entry recorded twice with the same id", async () => {
    const first = await recordA2ALog(store, entry({ id: "log_1", at: "2026-11-12T10:00:00+09:00", request: { visaNumber: "M123", note: "ok" } }), {
      extraFields: ["visaNumber"],
    });
    expect(first.request).toEqual({ visaNumber: MASK, note: "ok" });
    await recordA2ALog(store, entry({ id: "log_1", at: "2026-11-12T10:00:00+09:00", state: "TASK_STATE_FAILED" }));
    const all = await listA2ALog(store);
    expect(all).toHaveLength(1);
    expect(all[0]!.state).toBe("TASK_STATE_FAILED");
  });

  it("omits response when there is none", async () => {
    const stored = await recordA2ALog(store, entry({ id: "log_1", at: "2026-11-12T10:00:00+09:00" }));
    expect("response" in stored).toBe(false);
  });
});

describe("listA2ALog", () => {
  beforeEach(async () => {
    await recordA2ALog(store, entry({ id: "c", at: "2026-11-12T10:00:03+09:00", skillId: "platform.judge_quote" }));
    await recordA2ALog(
      store,
      entry({ id: "a", at: "2026-11-12T10:00:01+09:00", skillId: "platform.recipe", state: "TASK_STATE_COMPLETED" }),
    );
    await recordA2ALog(
      store,
      entry({
        id: "b",
        at: "2026-11-12T10:00:02+09:00",
        from: customer,
        to: clinic("mint"),
        skillId: "clinic.quote",
        taskId: "tsk_m1",
        state: "TASK_STATE_REJECTED",
      }),
    );
    await recordA2ALog(
      store,
      entry({ id: "z", contextId: "req_OTHER", at: "2026-11-12T10:00:00+09:00", skillId: "clinic.quote", to: clinic("ara") }),
    );
  });

  it("returns entries oldest first", async () => {
    expect((await listA2ALog(store)).map((e) => e.id)).toEqual(["z", "a", "b", "c"]);
  });

  it("orders by the real instant when offsets differ, not by the string", async () => {
    // 10:00 at +09:00 is 01:00Z, so it comes before 02:00Z although its string sorts after.
    await recordA2ALog(store, entry({ id: "kst", at: "2026-11-13T10:00:00+09:00" }));
    await recordA2ALog(store, entry({ id: "utc", at: "2026-11-13T02:00:00Z" }));
    const ids = (await listA2ALog(store)).map((e) => e.id);
    expect(ids.indexOf("kst")).toBeLessThan(ids.indexOf("utc"));
  });

  it("keeps recording order for calls at the same instant", async () => {
    const same = "2026-11-12T11:00:00+09:00";
    await recordA2ALog(store, entry({ id: "s2", at: same }));
    await recordA2ALog(store, entry({ id: "s1", at: same }));
    const ids = (await listA2ALog(store)).map((e) => e.id);
    expect(ids.slice(-2)).toEqual(["s2", "s1"]);
  });

  it("filters by context, task, skill, state, method, agent and role", async () => {
    const ids = async (filter: Parameters<typeof listA2ALog>[1]) => (await listA2ALog(store, filter)).map((e) => e.id);
    expect(await ids({ contextId: "req_01J9Z8" })).toEqual(["a", "b", "c"]);
    expect(await ids({ taskId: "tsk_m1" })).toEqual(["b"]);
    expect(await ids({ skillId: "clinic.quote" })).toEqual(["z", "b"]);
    expect(await ids({ state: "TASK_STATE_REJECTED" })).toEqual(["b"]);
    expect(await ids({ method: "GetTask" })).toEqual([]);
    expect(await ids({ agentId: "cln_mint" })).toEqual(["b"]);
    expect(await ids({ agentId: "cag_7f3k2" })).toEqual(["z", "a", "b", "c"]);
    expect(await ids({ role: "clinic" })).toEqual(["z", "b"]);
    expect(await ids({ contextId: "req_01J9Z8", role: "clinic", state: "TASK_STATE_REJECTED" })).toEqual(["b"]);
  });
});

describe("agentTimeline", () => {
  it("lists what the agents did for one request, with the sentence and the masked exchange", async () => {
    await recordA2ALog(
      store,
      entry({
        id: "a",
        at: "2026-11-12T10:00:01+09:00",
        request: { jsonrpc: "2.0", method: "SendMessage" },
        response: { jsonrpc: "2.0", result: {} },
        latencyMs: 120,
      }),
    );
    await recordA2ALog(
      store,
      entry({ id: "b", at: "2026-11-12T10:00:02+09:00", to: clinic("mint"), skillId: "clinic.quote", humanSummary: { ko: "민트에 견적을 요청했어요", ja: "ミントに見積もりを依頼しました" } }),
    );
    await recordA2ALog(store, entry({ id: "x", contextId: "req_OTHER", at: "2026-11-12T10:00:00+09:00" }));

    const timeline = await agentTimeline(store, "req_01J9Z8");
    expect(timeline.map((t) => t.id)).toEqual(["a", "b"]);
    expect(timeline[0]).toEqual({
      id: "a",
      at: "2026-11-12T10:00:01+09:00",
      actor: { agentId: "cag_7f3k2", role: "customer" },
      target: { agentId: "agt_platform", role: "platform" },
      skillId: "platform.match_clinics",
      state: "TASK_STATE_COMPLETED",
      latencyMs: 120,
      summary: { ko: "조건에 맞는 병원을 찾았어요" },
      raw: { request: { jsonrpc: "2.0", method: "SendMessage" }, response: { jsonrpc: "2.0", result: {} } },
    });
    expect(timeline[1]!.target).toEqual({ agentId: "cln_mint", role: "clinic" });
    expect(timeline[1]!.summary.ja).toBe("ミントに見積もりを依頼しました");
    expect("response" in timeline[1]!.raw).toBe(false);
    expect("latencyMs" in timeline[1]!).toBe(false);
  });

  it("is empty for an unknown request", async () => {
    expect(await agentTimeline(store, "req_NONE")).toEqual([]);
  });
});
