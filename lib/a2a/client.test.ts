import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetClock, setClock } from "../clock";
import { getStore, resetStore } from "../store";
import { routeFetch, seedA2A, TEST_CUSTOMERS } from "./__fixtures__/route-fetch";
import { verifyAgentToken } from "./auth";
import { A2AClientError, agentFromUrl, clearAgentCardCache, fetchAgentCard, getTask, sendMessage } from "./client";
import { listA2ALog } from "./log";
import { resetTaskStores } from "./server";

const BASE = "https://pibu.example";
const MINT_CARD = `${BASE}/a2a/clinics/mint/agent-card.json`;
const MINT_RPC = `${BASE}/a2a/clinics/mint/rpc`;
const PLATFORM_CARD = `${BASE}/a2a/platform/agent-card.json`;

const yuki = { agentId: TEST_CUSTOMERS.yuki, role: "customer" as const };

const quoteData = () => ({
  schema: "pibu/procedure-request@1",
  requestId: "req_01J9Z8",
  customerAgentId: "cag_7f3k2",
  procedureId: "rejuran_healer",
  amount: { value: 2, unit: "cc" },
  languages: ["ja"],
  dateWindow: { from: "2026-11-13", to: "2026-11-15" },
  visitorProfile: { nationality: "JP", firstKProcedure: true },
});

const quote = (extra: Partial<Parameters<typeof sendMessage>[0]> = {}) =>
  sendMessage({
    from: yuki,
    toCardUrl: MINT_CARD,
    skillId: "clinic.quote",
    data: quoteData(),
    text: "Quote request",
    contextId: "req_01J9Z8",
    metadata: { referralToken: "eyJhbGciOiJFUzI1NiJ9.example.signature" },
    fetchImpl: routeFetch,
    ...extra,
  });

/** routeFetch that records each request and can be told to misbehave on the rpc URL. */
function spyFetch(rpc?: (req: Request) => Promise<Response>) {
  const calls: Request[] = [];
  const impl: typeof fetch = async (input, init) => {
    const req = new Request(input, init);
    calls.push(req.clone());
    if (rpc && req.url.endsWith("/rpc")) return rpc(req);
    return routeFetch(req);
  };
  return { impl, calls };
}

/** Never answers; rejects like fetch does once the signal aborts. */
const hang = (req: Request) =>
  new Promise<Response>((_, reject) => {
    req.signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });

const log = () => listA2ALog(getStore());

beforeEach(async () => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("PUBLIC_BASE_URL", BASE);
  setClock("2026-11-12T10:00:00+09:00");
  resetStore();
  resetTaskStores();
  clearAgentCardCache();
  await seedA2A();
});

afterEach(() => {
  vi.useRealTimers();
  resetClock();
  vi.unstubAllEnvs();
});

describe("sendMessage and getTask", () => {
  it("round trip through the rpc route and leave the logging to the server", async () => {
    const task = await quote();
    expect(task.contextId).toBe("req_01J9Z8");
    expect(task.status.state).toBe("TASK_STATE_FAILED");

    const again = await getTask({ from: yuki, toCardUrl: MINT_CARD, taskId: task.id, fetchImpl: routeFetch });
    expect(again.id).toBe(task.id);
    expect(again.status.state).toBe("TASK_STATE_FAILED");

    const entries = await log();
    expect(entries.map((e) => [e.method, e.state])).toEqual([
      ["SendMessage", "TASK_STATE_FAILED"],
      ["GetTask", "TASK_STATE_FAILED"],
    ]);
  });

  it("send the 03 headers and pick the JSONRPC interface from the card", async () => {
    const { impl, calls } = spyFetch();
    await quote({ fetchImpl: impl, extensions: ["https://pibu.app/ext/referral/v1", "https://pibu.app/ext/zk-offer-proof/v1"] });
    const rpc = calls.find((r) => r.method === "POST")!;
    expect(rpc.url).toBe(MINT_RPC);
    expect(rpc.headers.get("a2a-version")).toBe("1.0");
    expect(rpc.headers.get("content-type")).toBe("application/json");
    expect(rpc.headers.get("a2a-extensions")).toBe("https://pibu.app/ext/referral/v1,https://pibu.app/ext/zk-offer-proof/v1");
    expect(await verifyAgentToken(rpc.headers.get("authorization"))).toEqual(yuki);

    const body = (await rpc.json()) as { method: string; params: { message: Record<string, any> } };
    expect(body.method).toBe("SendMessage");
    expect(body.params.message.metadata).toEqual({ referralToken: "eyJhbGciOiJFUzI1NiJ9.example.signature", skillId: "clinic.quote" });
    expect(body.params.message.parts[1].data).toEqual(quoteData());
  });

  it("raise kind rpc for a JSON-RPC error", async () => {
    const error = await sendMessage({
      from: yuki,
      toCardUrl: MINT_CARD,
      skillId: "platform.recipe",
      data: { schema: "pibu/recipe-query@1", concerns: ["elasticity"], ageBand: "25-29" },
      contextId: "req_01J9Z8",
      fetchImpl: routeFetch,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(A2AClientError);
    expect(error).toMatchObject({ kind: "rpc", code: -32602 });
    expect(await log()).toHaveLength(1);
  });

  it("raise kind http with status and code for a refused role", async () => {
    const error = await sendMessage({
      from: { agentId: "cln_mint", role: "clinic" },
      toCardUrl: `${BASE}/a2a/customers/cag_7f3k2/agent-card.json`,
      skillId: "customer.checkin",
      data: { schema: "pibu/checkin-request@1", bookingId: "bkg_5521", checkpoint: "D7", questions: ["q"] },
      contextId: "req_01J9Z8",
      fetchImpl: routeFetch,
    }).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "http", status: 403, code: -32098 });
    // Only the server's entry: the client does not log what the server saw.
    expect(await log()).toHaveLength(1);
  });

  it("reach a customer agent, whose card needs a token", async () => {
    const task = await sendMessage({
      from: { agentId: "agt_platform", role: "platform" },
      toCardUrl: `${BASE}/a2a/customers/cag_7f3k2/agent-card.json`,
      skillId: "customer.notify",
      data: { schema: "pibu/notification@1", kind: "notice", text: { ja: "お知らせ" } },
      contextId: "req_01J9Z8",
      fetchImpl: routeFetch,
    });
    expect(task.status.state).toBe("TASK_STATE_FAILED");
  });
});

describe("failures the server cannot see", () => {
  it("time out after timeoutMs and log one entry without a state", async () => {
    const { impl } = spyFetch(hang);
    const error = await quote({ fetchImpl: impl, timeoutMs: 50 }).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "timeout" });

    const entries = await log();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      method: "SendMessage",
      skillId: "clinic.quote",
      contextId: "req_01J9Z8",
      from: yuki,
      to: { agentId: "cln_mint", role: "clinic", url: MINT_RPC },
      humanSummary: { ko: "견적 · 응답이 없었어요" },
    });
    expect(entries[0].state).toBeUndefined();
    expect(entries[0].response).toBeUndefined();
    expect(entries[0].latencyMs).toBeGreaterThanOrEqual(40);
  });

  it("wait 20 seconds by default", async () => {
    await fetchAgentCard(MINT_CARD, { fetchImpl: routeFetch });
    vi.useFakeTimers();
    const { impl } = spyFetch(hang);
    let settled: unknown;
    const pending = quote({ fetchImpl: impl }).catch((e: unknown) => (settled = e));
    await vi.advanceTimersByTimeAsync(19_999);
    expect(settled).toBeUndefined();
    await vi.advanceTimersByTimeAsync(1);
    await pending;
    expect(settled).toMatchObject({ kind: "timeout" });
  });

  it("log network errors and replies that are not JSON", async () => {
    const down = spyFetch(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await quote({ fetchImpl: down.impl }).catch((e: unknown) => e)).toMatchObject({ kind: "network" });

    const html = spyFetch(async () => new Response("<html>bad gateway</html>", { status: 502 }));
    expect(await quote({ fetchImpl: html.impl }).catch((e: unknown) => e)).toMatchObject({ kind: "invalid_response", status: 502 });

    const entries = await log();
    expect(entries).toHaveLength(2);
    for (const entry of entries) expect(entry.state).toBeUndefined();
  });
});

describe("agent card cache", () => {
  it("fetches a card once per 60 seconds", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { impl, calls } = spyFetch();
    const cardFetches = () => calls.filter((r) => r.method === "GET" && r.url === MINT_CARD).length;

    await quote({ fetchImpl: impl });
    await quote({ fetchImpl: impl });
    expect(cardFetches()).toBe(1);
    expect(calls.filter((r) => r.method === "POST")).toHaveLength(2);

    vi.advanceTimersByTime(59_000);
    await quote({ fetchImpl: impl });
    expect(cardFetches()).toBe(1);

    vi.advanceTimersByTime(2_000);
    await quote({ fetchImpl: impl });
    expect(cardFetches()).toBe(2);
  });

  it("raises kind http for a missing card", async () => {
    const error = await fetchAgentCard(`${BASE}/a2a/clinics/nope/agent-card.json`, { fetchImpl: routeFetch }).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: "http", status: 404 });
    expect((await fetchAgentCard(PLATFORM_CARD, { fetchImpl: routeFetch })).name).toBe("Pibu Platform Agent");
  });
});

describe("agentFromUrl", () => {
  it("names the agent behind a 03 URL", () => {
    expect(agentFromUrl(`${BASE}/a2a/clinics/seoul-glow/rpc`)).toEqual({ agentId: "cln_seoul_glow", role: "clinic" });
    expect(agentFromUrl(`${BASE}/a2a/customers/cag_7f3k2/agent-card.json`)).toEqual({ agentId: "cag_7f3k2", role: "customer" });
    expect(agentFromUrl(`${BASE}/a2a/platform/rpc`)).toEqual({ agentId: "agt_platform", role: "platform" });
  });
});
