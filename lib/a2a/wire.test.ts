import { describe, expect, it } from "vitest";
import { PIBU_SCHEMAS, parsePibuData } from "./schemas";
import {
  JsonRpcRequestSchema,
  JsonRpcResponseSchema,
  TASK_STATES,
  TASK_STATE_COPY_KO,
  WireMessageSchema,
  WireTaskSchema,
  buildSendMessageRequest,
  firstDataPart,
  isInterruptedState,
  isTerminalState,
  jsonRpcError,
  jsonRpcResult,
  taskArtifactData,
  taskArtifactText,
  taskFromSendMessageResult,
} from "./wire";

const referralToken = "eyJhbGciOiJFUzI1NiJ9.example.signature";

// docs/spec/03-a2a-protocol.md "SendMessage 와이어 예시 (고객 → 병원 견적)"
const quoteRequestData = {
  schema: "pibu/procedure-request@1",
  requestId: "req_01J9Z8",
  customerAgentId: "cag_7f3k2",
  procedureId: "rejuran_healer",
  amount: { value: 2, unit: "cc" },
  languages: ["ja"],
  dateWindow: { from: "2026-11-13", to: "2026-11-15" },
  visitorProfile: { nationality: "JP", firstKProcedure: true },
};

const specRequest = {
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
        { data: quoteRequestData, mediaType: "application/json" },
      ],
      metadata: { skillId: "clinic.quote", referralToken },
      extensions: ["https://pibu.app/ext/referral/v1"],
    },
    configuration: { acceptedOutputModes: ["application/json", "text/plain"] },
  },
};

// "SendMessage 응답 와이어 예시 (병원 → 고객 견적)"
const specResponse = {
  jsonrpc: "2.0",
  id: "rpc_0003",
  result: {
    task: {
      id: "tsk_k2_0001",
      contextId: "req_01J9Z8",
      status: { state: "TASK_STATE_COMPLETED", timestamp: "2026-11-12T10:00:03+09:00" },
      artifacts: [
        {
          artifactId: "art_qt_1203",
          name: "quote",
          parts: [
            {
              data: {
                schema: "pibu/quote@1",
                quoteId: "qt_1203",
                requestId: "req_01J9Z8",
                clinicId: "cln_seoul_glow",
                procedureId: "rejuran_healer",
                product: "Rejuran Healer",
                amount: { value: 2, unit: "cc" },
                priceKrw: 340000,
                vatIncluded: true,
                includes: ["numbing_cream", "soothing_mask"],
                excludes: [],
                slots: ["2026-11-14T11:00:00+09:00"],
                languages: ["ja"],
                indicative: false,
                validUntil: "2026-11-20",
                operationMode: "clinic",
              },
              mediaType: "application/json",
            },
          ],
        },
      ],
    },
  },
};

describe("SendMessage request builder", () => {
  it("reproduces the request in the spec example exactly", () => {
    const built = buildSendMessageRequest({
      rpcId: "rpc_0003",
      messageId: "msg_c_0003",
      contextId: "req_01J9Z8",
      skillId: "clinic.quote",
      text: "Quote request for Rejuran Healer 2cc, 11-13~11-15, Japanese support.",
      data: quoteRequestData,
      metadata: { referralToken },
      extensions: ["https://pibu.app/ext/referral/v1"],
    });
    expect(built).toEqual(specRequest);
    expect(JsonRpcRequestSchema.safeParse(built).success).toBe(true);
  });

  it("builds a request that the receiving side accepts, end to end", () => {
    const built = buildSendMessageRequest({
      rpcId: 1,
      messageId: "msg_1",
      contextId: "req_01J9Z8",
      skillId: "clinic.quote",
      data: quoteRequestData,
    });
    const message = WireMessageSchema.parse((built.params as { message: unknown }).message);
    expect(parsePibuData("clinic.quote", firstDataPart(message)).ok).toBe(true);
  });

  it("puts skillId last in metadata so extra metadata cannot override it", () => {
    const built = buildSendMessageRequest({
      rpcId: 1,
      messageId: "m",
      contextId: "req_1",
      skillId: "clinic.quote",
      data: {},
      metadata: { skillId: "platform.recipe", referralToken },
    });
    const message = (built.params as { message: { metadata: Record<string, unknown> } }).message;
    expect(message.metadata.skillId).toBe("clinic.quote");
  });

  it("continues an existing task and omits text when there is none", () => {
    const built = buildSendMessageRequest({
      rpcId: 2,
      messageId: "m2",
      contextId: "req_1",
      taskId: "tsk_9",
      skillId: "clinic.quote",
      data: { schema: "pibu/input-response@1", values: {} },
    });
    const message = (built.params as { message: { taskId: string; parts: unknown[] } }).message;
    expect(message.taskId).toBe("tsk_9");
    expect(message.parts).toHaveLength(1);
  });

  it("always sets returnImmediately for skills a human confirms and refuses to turn it off", () => {
    for (const skillId of ["clinic.book", "customer.checkin"] as const) {
      const built = buildSendMessageRequest({ rpcId: 1, messageId: "m", contextId: "req_1", skillId, data: {} });
      expect((built.params as { configuration: Record<string, unknown> }).configuration.returnImmediately).toBe(true);
      expect(() =>
        buildSendMessageRequest({ rpcId: 1, messageId: "m", contextId: "req_1", skillId, data: {}, returnImmediately: false }),
      ).toThrow(/returnImmediately/);
    }
  });

  it("leaves returnImmediately out for instant skills unless asked", () => {
    const plain = buildSendMessageRequest({ rpcId: 1, messageId: "m", contextId: "req_1", skillId: "platform.recipe", data: {} });
    expect("returnImmediately" in (plain.params as { configuration: object }).configuration).toBe(false);
    const asked = buildSendMessageRequest({
      rpcId: 1,
      messageId: "m",
      contextId: "req_1",
      skillId: "platform.recipe",
      data: {},
      returnImmediately: true,
    });
    expect((asked.params as { configuration: Record<string, unknown> }).configuration.returnImmediately).toBe(true);
  });
});

describe("responses", () => {
  it("parses the spec response and its quote artifact", () => {
    expect(JsonRpcResponseSchema.safeParse(specResponse).success).toBe(true);
    const task = taskFromSendMessageResult(specResponse.result);
    expect(task?.status.state).toBe("TASK_STATE_COMPLETED");
    const data = taskArtifactData(task!);
    expect(PIBU_SCHEMAS["pibu/quote@1"].safeParse(data).success).toBe(true);
    expect(taskArtifactText(task!)).toBeUndefined();
  });

  it("reads text-only artifacts", () => {
    const task = WireTaskSchema.parse({
      id: "tsk_1",
      contextId: "req_1",
      status: { state: "TASK_STATE_COMPLETED" },
      artifacts: [{ artifactId: "a1", parts: [{ text: "received" }] }],
    });
    expect(taskArtifactText(task)).toBe("received");
    expect(taskArtifactData(task)).toBeUndefined();
  });

  it("does not mistake a bare GetTask result or a malformed task for a SendMessage result", () => {
    expect(taskFromSendMessageResult(specResponse.result.task)).toBeUndefined();
    expect(taskFromSendMessageResult({ task: { id: "t" } })).toBeUndefined();
    expect(taskFromSendMessageResult(null)).toBeUndefined();
  });

  it("rejects unknown task states, empty parts and parts without content", () => {
    const base = { id: "t", contextId: "req_1", status: { state: "TASK_STATE_COMPLETED" } };
    expect(WireTaskSchema.safeParse(base).success).toBe(true);
    expect(WireTaskSchema.safeParse({ ...base, status: { state: "TASK_STATE_DONE" } }).success).toBe(false);
    expect(WireTaskSchema.safeParse({ ...base, artifacts: [{ artifactId: "a", parts: [] }] }).success).toBe(false);
    expect(WireTaskSchema.safeParse({ ...base, artifacts: [{ artifactId: "a", parts: [{}] }] }).success).toBe(false);
    expect(WireMessageSchema.safeParse({ messageId: "m", role: "ROLE_SYSTEM", parts: [{ text: "x" }] }).success).toBe(false);
  });

  it("tolerates fields from other A2A implementations", () => {
    const task = WireTaskSchema.safeParse({
      id: "t",
      contextId: "req_1",
      status: { state: "TASK_STATE_WORKING", extra: true },
      history: [],
      kind: "task",
    });
    expect(task.success).toBe(true);
  });

  it("builds JSON-RPC results and errors", () => {
    expect(jsonRpcResult("r1", { ok: true })).toEqual({ jsonrpc: "2.0", id: "r1", result: { ok: true } });
    expect(jsonRpcError(7, -32602, "bad")).toEqual({ jsonrpc: "2.0", id: 7, error: { code: -32602, message: "bad" } });
    expect(jsonRpcError(null, -32602, "bad", { issues: [] })).toEqual({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32602, message: "bad", data: { issues: [] } },
    });
    expect(JsonRpcResponseSchema.safeParse(jsonRpcError("r", -32602, "bad")).success).toBe(true);
    expect(JsonRpcResponseSchema.safeParse({ jsonrpc: "2.0", id: "r" }).success).toBe(false);
  });
});

describe("task states", () => {
  it("classifies terminal and interrupted states and has customer copy for every state", () => {
    const terminal = TASK_STATES.filter(isTerminalState);
    const interrupted = TASK_STATES.filter(isInterruptedState);
    expect(terminal).toEqual(["TASK_STATE_COMPLETED", "TASK_STATE_REJECTED", "TASK_STATE_FAILED", "TASK_STATE_CANCELED"]);
    expect(interrupted).toEqual(["TASK_STATE_INPUT_REQUIRED", "TASK_STATE_AUTH_REQUIRED"]);
    expect(isTerminalState("TASK_STATE_WORKING")).toBe(false);
    for (const state of TASK_STATES) expect(state in TASK_STATE_COPY_KO).toBe(true);
    expect(TASK_STATE_COPY_KO.TASK_STATE_AUTH_REQUIRED).toBeNull();
    expect(TASK_STATE_COPY_KO.TASK_STATE_WORKING).toBe("병원에서 확인하고 있어요");
  });
});
