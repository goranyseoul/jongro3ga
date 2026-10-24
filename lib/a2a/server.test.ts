import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ListTasksRequest, Task } from "@a2a-js/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as clinicRpc } from "../../app/a2a/clinics/[slug]/rpc/route";
import { GET as customerCardGet } from "../../app/a2a/customers/[agentId]/agent-card.json/route";
import { POST as customerRpc } from "../../app/a2a/customers/[agentId]/rpc/route";
import { GET as platformCardGet } from "../../app/a2a/platform/agent-card.json/route";
import { GET as jwksGet } from "../../app/a2a/platform/jwks.json/route";
import { POST as platformRpc } from "../../app/a2a/platform/rpc/route";
import { resetClock, setClock } from "../clock";
import type { A2ALogEntry } from "../domain";
import { getStore, resetStore } from "../store";
import { seedA2A, TEST_CUSTOMERS } from "./__fixtures__/route-fetch";
import { issueAgentToken } from "./auth";
import { listA2ALog } from "./log";
import { callContextFor, resetTaskStores, taskStoreFor } from "./server";

const BASE = "https://pibu.example";
const MINT_RPC = `${BASE}/a2a/clinics/mint/rpc`;

// 03 "SendMessage 와이어 예시 (고객 → 병원 견적)", verbatim.
const quoteRequest = () => ({
  jsonrpc: "2.0",
  id: "rpc_0003",
  method: "SendMessage",
  params: {
    message: {
      messageId: "msg_c_0003",
      contextId: "req_01J9Z8",
      role: "ROLE_USER",
      parts: [
        { text: "Quote request for Rejuran Healer 2cc, 11-13~11-15, Japanese support." },
        {
          data: {
            schema: "pibu/procedure-request@1",
            requestId: "req_01J9Z8",
            customerAgentId: "cag_7f3k2",
            procedureId: "rejuran_healer",
            amount: { value: 2, unit: "cc" },
            languages: ["ja"],
            dateWindow: { from: "2026-11-13", to: "2026-11-15" },
            visitorProfile: { nationality: "JP", firstKProcedure: true },
          },
          mediaType: "application/json",
        },
      ],
      metadata: { skillId: "clinic.quote", referralToken: "eyJhbGciOiJFUzI1NiJ9.example.signature" },
      extensions: ["https://pibu.app/ext/referral/v1"],
    },
    configuration: { acceptedOutputModes: ["application/json", "text/plain"] },
  },
});

/** The ZK variant with an offer proof the size of a real one (about 14KB). */
const quoteRequestWithProof = () => {
  const body = quoteRequest();
  const message = body.params.message as Record<string, unknown>;
  message.metadata = {
    ...(message.metadata as object),
    offerProof: {
      schema: "pibu/offer-proof@1",
      offerId: "ofr_mint_rejuran_first_visit",
      clinicId: "cln_mint",
      subjectId: "0x5c0d6f0a8c2e4b1f9d3a7e6c5b4a39281716050403020100ffeeddccbbaa9988",
      chainId: 84532,
      registry: "0xcf47152e720508bf8c757a55aa30956ca8b58857",
      today: 29880272,
      proofs: [{ proof: `0x${"ab".repeat(14000)}`, publicInputs: ["0x0b1c2d3e", "29880272", "0", "2", "0", "100000", "0", "0"] }],
    },
  };
  message.extensions = ["https://pibu.app/ext/referral/v1", "https://pibu.app/ext/zk-offer-proof/v1"];
  return body;
};

const ctx = <P>(params: P) => ({ params: Promise.resolve(params) });

const token = (agentId: string, role: "customer" | "clinic" | "platform") => issueAgentToken({ agentId, role });

async function post(
  route: (req: Request, c: { params: Promise<never> }) => Promise<Response>,
  url: string,
  params: object,
  body: unknown,
  headers: Record<string, string> = {},
) {
  const req = new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "A2A-Version": "1.0", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const res = await route(req, ctx(params as never));
  return { status: res.status, json: (await res.json()) as Record<string, any> };
}

const asYuki = async () => ({ Authorization: `Bearer ${await token(TEST_CUSTOMERS.yuki, "customer")}` });

const getTaskBody = (id: string) => ({ jsonrpc: "2.0", id: "rpc_get", method: "GetTask", params: { id } });

const log = (): Promise<A2ALogEntry[]> => listA2ALog(getStore());

beforeEach(async () => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("PUBLIC_BASE_URL", BASE);
  setClock("2026-11-12T10:00:00+09:00");
  resetStore();
  resetTaskStores();
  await seedA2A();
});

afterEach(() => {
  resetClock();
  vi.unstubAllEnvs();
});

describe("rpc route: authentication", () => {
  it("(a) answers 401 without a token and logs the refusal", async () => {
    const res = await post(clinicRpc, MINT_RPC, { slug: "mint" }, quoteRequest());
    expect(res.status).toBe(401);
    expect(res.json).toEqual({ jsonrpc: "2.0", id: null, error: { code: -32099, message: "unauthorized" } });

    const entries = await log();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ method: "SendMessage", skillId: "clinic.quote", from: { agentId: "unauthenticated" } });
    expect(entries[0].state).toBeUndefined();
    expect(entries[0].humanSummary.ko).toContain("인증되지 않은");
  });

  it("answers 401 for a tampered token and 404 for an unknown clinic", async () => {
    const good = await token(TEST_CUSTOMERS.yuki, "customer");
    const bad = await post(clinicRpc, MINT_RPC, { slug: "mint" }, quoteRequest(), { Authorization: `Bearer ${good}x` });
    expect(bad.status).toBe(401);
    const missing = await post(clinicRpc, `${BASE}/a2a/clinics/nope/rpc`, { slug: "nope" }, quoteRequest(), await asYuki());
    expect(missing.status).toBe(404);
  });
});

describe("rpc route: SendMessage", () => {
  it("(b) runs the 03 quote request through the SDK and logs exactly one entry", async () => {
    const res = await post(clinicRpc, MINT_RPC, { slug: "mint" }, quoteRequest(), await asYuki());
    expect(res.status).toBe(200);
    expect(res.json.id).toBe("rpc_0003");
    const task = res.json.result.task;
    expect(task.contextId).toBe("req_01J9Z8");
    expect(task.status.state).toBe("TASK_STATE_FAILED");
    expect(task.status.message.parts[0].text).toBe("skill clinic.quote is not implemented");

    const entries = await log();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      method: "SendMessage",
      skillId: "clinic.quote",
      contextId: "req_01J9Z8",
      taskId: task.id,
      state: "TASK_STATE_FAILED",
      from: { agentId: "cag_7f3k2", role: "customer" },
      to: { agentId: "cln_mint", role: "clinic", url: MINT_RPC },
    });
    expect(entries[0].latencyMs).toBeGreaterThanOrEqual(0);
    expect(entries[0].request).toEqual(quoteRequest());
    expect((entries[0].response as Record<string, any>).result.task.id).toBe(task.id);
    expect(entries[0].humanSummary.ko).toBe("견적 · 문제가 생겼어요");
  });

  it("(b) stores a long offer proof as a size note", async () => {
    const res = await post(clinicRpc, MINT_RPC, { slug: "mint" }, quoteRequestWithProof(), await asYuki());
    expect(res.json.result.task.status.state).toBe("TASK_STATE_FAILED");
    const [entry] = await log();
    const request = entry.request as Record<string, any>;
    expect(request.params.message.metadata.offerProof.proofs[0].proof).toMatch(/^\[proof \d+(\.\d)?KB\]$/);
    expect(request.params.message.metadata.offerProof.proofs[0].publicInputs).toHaveLength(8);
  });

  it("(c) refuses a clinic calling customer.checkin with 403 and -32098", async () => {
    const body = quoteRequest();
    body.params.message.metadata = { skillId: "customer.checkin" } as never;
    body.params.message.parts = [{ data: { schema: "pibu/checkin-request@1", bookingId: "bkg_5521", checkpoint: "D7", questions: ["q"] } }] as never;
    const res = await post(customerRpc, `${BASE}/a2a/customers/cag_7f3k2/rpc`, { agentId: "cag_7f3k2" }, body, {
      Authorization: `Bearer ${await token("cln_mint", "clinic")}`,
    });
    expect(res.status).toBe(403);
    expect(res.json.error).toEqual({ code: -32098, message: "forbidden: role clinic cannot call customer.checkin" });
    const [entry] = await log();
    expect(entry).toMatchObject({ skillId: "customer.checkin", from: { agentId: "cln_mint", role: "clinic" }, to: { agentId: "cag_7f3k2" } });
    expect(entry.state).toBeUndefined();

    // The platform may call it.
    const ok = await post(customerRpc, `${BASE}/a2a/customers/cag_7f3k2/rpc`, { agentId: "cag_7f3k2" }, body, {
      Authorization: `Bearer ${await token("agt_platform", "platform")}`,
    });
    expect(ok.status).toBe(200);
    expect(ok.json.result.task.status.state).toBe("TASK_STATE_FAILED");
  });

  it("(d) answers -32602 and creates no task for a missing skillId, a foreign skill or a schema mismatch", async () => {
    const noSkill = quoteRequest();
    noSkill.params.message.metadata = { referralToken: "x" } as never;
    const foreign = quoteRequest();
    foreign.params.message.metadata = { skillId: "platform.match_clinics" } as never;
    const wrongSchema = quoteRequest();
    (wrongSchema.params.message.parts[1] as { data: Record<string, unknown> }).data.schema = "pibu/booking-request@1";
    const badField = quoteRequest();
    (badField.params.message.parts[1] as { data: Record<string, unknown> }).data.amount = { value: -1, unit: "cc" };
    const noData = quoteRequest();
    noData.params.message.parts = [noData.params.message.parts[0]];

    for (const body of [noSkill, foreign, wrongSchema, badField, noData]) {
      const res = await post(clinicRpc, MINT_RPC, { slug: "mint" }, body, await asYuki());
      expect(res.status).toBe(200);
      expect(res.json.error.code).toBe(-32602);
      expect(res.json.result).toBeUndefined();
    }
    const badFieldRes = await post(clinicRpc, MINT_RPC, { slug: "mint" }, badField, await asYuki());
    expect(badFieldRes.json.error.data.issues[0].path).toBe("amount.value");

    const entries = await log();
    expect(entries).toHaveLength(6);
    for (const entry of entries) {
      expect(entry.state).toBeUndefined();
      expect(entry.taskId).toBeUndefined();
      expect(entry.humanSummary.en).toContain("format is invalid");
    }
    const tasks = await taskStoreFor("clinic:mint").list(ListTasksRequest.fromJSON({}), callContextFor("cag_7f3k2", "customer"));
    expect(tasks.tasks).toHaveLength(0);
  });

  it("(d) applies rule 3: input-response only for a task waiting for input", async () => {
    const first = await post(clinicRpc, MINT_RPC, { slug: "mint" }, quoteRequest(), await asYuki());
    const taskId = first.json.result.task.id as string;
    const follow = quoteRequest();
    Object.assign(follow.params.message, { messageId: "msg_c_0004", taskId });
    follow.params.message.parts = [{ data: { schema: "pibu/input-response@1", values: { passportName: "YUKI" } } }] as never;
    const res = await post(clinicRpc, MINT_RPC, { slug: "mint" }, follow, await asYuki());
    expect(res.json.error.code).toBe(-32602);
    expect(res.json.error.message).toContain("INPUT_REQUIRED");
  });

  it("(d) applies rule 3: a task waiting for input takes input-response and nothing else", async () => {
    // A clinic.book task parked in INPUT_REQUIRED, written the way WP3 writes tasks out of band.
    const store = taskStoreFor("clinic:mint");
    const asCaller = callContextFor(TEST_CUSTOMERS.yuki, "customer");
    await store.save(
      Task.fromJSON({
        id: "tsk_wait",
        contextId: "req_01J9Z8",
        status: { state: "TASK_STATE_INPUT_REQUIRED" },
        history: [{ messageId: "msg_b", role: "ROLE_USER", parts: [{ text: "book" }], metadata: { skillId: "clinic.book" } }],
      }),
      asCaller,
    );
    const answer = (skillId: string, data: Record<string, unknown>) => {
      const body = quoteRequest();
      Object.assign(body.params.message, { messageId: `msg_${skillId}_${String(data.schema)}`, taskId: "tsk_wait" });
      body.params.message.metadata = { skillId } as never;
      body.params.message.parts = [{ data }] as never;
      return body;
    };
    const inputResponse = { schema: "pibu/input-response@1", values: { passportName: "YUKI" } };

    const wrongSkill = await post(clinicRpc, MINT_RPC, { slug: "mint" }, answer("clinic.quote", inputResponse), await asYuki());
    expect(wrongSkill.json.error.code).toBe(-32602);
    expect(wrongSkill.json.error.message).toContain("belongs to clinic.book");

    const notAnAnswer = await post(
      clinicRpc,
      MINT_RPC,
      { slug: "mint" },
      answer("clinic.book", { schema: "pibu/cancel-request@1", bookingId: "bkg_1", reason: "x" }),
      await asYuki(),
    );
    expect(notAnAnswer.json.error.code).toBe(-32602);

    const ok = await post(clinicRpc, MINT_RPC, { slug: "mint" }, answer("clinic.book", inputResponse), await asYuki());
    expect(ok.json.error).toBeUndefined();
    expect(ok.json.result.task.id).toBe("tsk_wait");
  });

  it("(d) refuses a valid request for a skill this agent does not have", async () => {
    const body = quoteRequest();
    body.params.message.metadata = { skillId: "platform.match_clinics" } as never;
    const data = (body.params.message.parts[1] as { data: Record<string, unknown> }).data;
    data.visitorProfile = { nationality: "JP", residency: "short_term_visitor", ageBand: "25-29" };
    const res = await post(clinicRpc, MINT_RPC, { slug: "mint" }, body, await asYuki());
    expect(res.json.error.code).toBe(-32602);
    expect(res.json.error.message).toBe("unknown skillId for this agent: platform.match_clinics");

    // The same request is fine at the platform.
    const atPlatform = await post(platformRpc, `${BASE}/a2a/platform/rpc`, {}, body, await asYuki());
    expect(atPlatform.json.result.task.status.state).toBe("TASK_STATE_FAILED");
  });
});

describe("rpc route: protocol checks", () => {
  it("(e) refuses A2A-Version 0.3 with -32009 and treats a missing header as 1.0", async () => {
    const old = await post(clinicRpc, MINT_RPC, { slug: "mint" }, quoteRequest(), { ...(await asYuki()), "A2A-Version": "0.3" });
    expect(old.json.error.code).toBe(-32009);

    const req = new Request(MINT_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await asYuki()) },
      body: JSON.stringify(quoteRequest()),
    });
    const res = await clinicRpc(req, ctx({ slug: "mint" }));
    expect(((await res.json()) as Record<string, any>).result.task.status.state).toBe("TASK_STATE_FAILED");
  });

  it("(f) refuses SendStreamingMessage and SubscribeToTask with -32004", async () => {
    for (const method of ["SendStreamingMessage", "SubscribeToTask"]) {
      const body = { ...quoteRequest(), method };
      const res = await post(clinicRpc, MINT_RPC, { slug: "mint" }, body, await asYuki());
      expect(res.json.error.code).toBe(-32004);
    }
  });

  it("answers -32700 for a body that is not JSON", async () => {
    const res = await post(clinicRpc, MINT_RPC, { slug: "mint" }, "{not json", await asYuki());
    expect(res.json.error.code).toBe(-32700);
  });
});

describe("rpc route: GetTask and CancelTask", () => {
  it("(h) shows a task to its caller only", async () => {
    const sent = await post(platformRpc, `${BASE}/a2a/platform/rpc`, {}, recipeRequest(), await asYuki());
    const taskId = sent.json.result.task.id as string;
    expect(sent.json.result.task.status.state).toBe("TASK_STATE_FAILED");

    const mine = await post(platformRpc, `${BASE}/a2a/platform/rpc`, {}, getTaskBody(taskId), await asYuki());
    expect(mine.json.result.id).toBe(taskId);
    expect(mine.json.result.status.state).toBe("TASK_STATE_FAILED");

    const other = await post(platformRpc, `${BASE}/a2a/platform/rpc`, {}, getTaskBody(taskId), {
      Authorization: `Bearer ${await token(TEST_CUSTOMERS.other, "customer")}`,
    });
    expect(other.json.error.code).toBe(-32001);

    const entries = await log();
    expect(entries.map((e) => e.method)).toEqual(["SendMessage", "GetTask", "GetTask"]);
    expect(entries[1]).toMatchObject({ taskId, skillId: "platform.recipe", state: "TASK_STATE_FAILED" });
    expect(entries[2].state).toBeUndefined();
  });

  it("refuses to cancel a finished task with the SDK error", async () => {
    const sent = await post(platformRpc, `${BASE}/a2a/platform/rpc`, {}, recipeRequest(), await asYuki());
    const res = await post(
      platformRpc,
      `${BASE}/a2a/platform/rpc`,
      {},
      { jsonrpc: "2.0", id: "c1", method: "CancelTask", params: { id: sent.json.result.task.id } },
      await asYuki(),
    );
    expect(res.json.error.code).toBe(-32002);
  });
});

describe("agent card routes", () => {
  it("(g) serves the platform card publicly and rewrites /.well-known to it", async () => {
    const res = await platformCardGet();
    expect(res.status).toBe(200);
    const card = (await res.json()) as Record<string, any>;
    expect(card.name).toBe("Pibu Platform Agent");
    expect(card.supportedInterfaces[0].url).toBe(`${BASE}/a2a/platform/rpc`);

    const config = readFileSync(join(process.cwd(), "next.config.ts"), "utf8");
    expect(config).toMatch(/source:\s*"\/\.well-known\/agent-card\.json",\s*destination:\s*"\/a2a\/platform\/agent-card\.json"/);
  });

  it("(g) hides the customer card without a token", async () => {
    const url = `${BASE}/a2a/customers/cag_7f3k2/agent-card.json`;
    const anonymous = await customerCardGet(new Request(url), ctx({ agentId: "cag_7f3k2" }));
    expect(anonymous.status).toBe(401);

    const asClinic = await customerCardGet(
      new Request(url, { headers: { Authorization: `Bearer ${await token("cln_mint", "clinic")}` } }),
      ctx({ agentId: "cag_7f3k2" }),
    );
    expect(asClinic.status).toBe(200);
    expect(((await asClinic.json()) as Record<string, any>).name).toBe("Pibu Customer Agent cag_7f3k2");

    const unknown = await customerCardGet(
      new Request(url, { headers: { Authorization: `Bearer ${await token("cln_mint", "clinic")}` } }),
      ctx({ agentId: "cag_nobody" }),
    );
    expect(unknown.status).toBe(404);
  });

  it("publishes the referral public key", async () => {
    const set = (await (await jwksGet()).json()) as { keys: Array<Record<string, unknown>> };
    expect(set.keys[0]).toMatchObject({ kty: "EC", alg: "ES256" });
    expect(set.keys[0].d).toBeUndefined();
  });
});

function recipeRequest() {
  return {
    jsonrpc: "2.0",
    id: "rpc_r1",
    method: "SendMessage",
    params: {
      message: {
        messageId: "msg_r1",
        contextId: "req_01J9Z8",
        role: "ROLE_USER",
        parts: [{ data: { schema: "pibu/recipe-query@1", concerns: ["elasticity"], ageBand: "25-29" }, mediaType: "application/json" }],
        metadata: { skillId: "platform.recipe" },
      },
      configuration: { acceptedOutputModes: ["application/json", "text/plain"] },
    },
  };
}
