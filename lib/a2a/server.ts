// A2A JSON-RPC server: turns an AgentDefinition (./contract.ts) into Next.js route handlers. OWNER: track A2A core.
//
// Spec-conformant handler over the wire JSON instead of the @a2a-js/sdk DefaultRequestHandler
// (decision and reasons in docs/spec/BUILD-LOG.md, track A2A). In short: the SDK keeps tasks and the
// blocking/returnImmediately bookkeeping in process memory (InMemoryTaskStore + ExecutionEventBus), which
// breaks GetTask polling across serverless instances, it speaks SDK internal types ($case parts, numeric
// states) that our executors would have to convert, and a -32602 routing failure must be answered
// before any task exists. Here tasks live in the shared store (./tasks.ts) and handlers see wire JSON.
//
// Methods: SendMessage, GetTask, CancelTask (P0, 03 "바인딩과 엔드포인트"). Streaming and push methods
// answer UnsupportedOperation (-32004) because the cards declare streaming: false.
import { ensureSeeded } from "../../data/seed/load";
import { clock } from "../clock";
import type { A2ALogEntry } from "../domain";
import { getStore } from "../store";
import { verifyAgentToken } from "./auth";
import { publicBaseUrl } from "./cards";
import { humanSummaryFor, LOG_ID_HEADER } from "./client";
import type { AgentDefinition, AgentRef, AgentRole, SkillContext, SkillResult } from "./contract";
import { recordA2ALog } from "./log";
import { INVALID_PARAMS, isSkillId, parsePibuData, type SkillId } from "./schemas";
import { applySkillResult, loadTaskRecord, newId, newWireTask, sameAgent, saveTaskRecord, type TaskRecord } from "./tasks";
import {
  firstDataPart,
  isInterruptedState,
  isTerminalState,
  jsonRpcError,
  jsonRpcResult,
  JsonRpcRequestSchema,
  WireMessageSchema,
  type JsonRpcResponse,
  type WireTask,
} from "./wire";

// ---- error codes ----

export const PARSE_ERROR = -32700;
export const INVALID_REQUEST = -32600;
export const METHOD_NOT_FOUND = -32601;
export const INTERNAL_ERROR = -32603;
export const TASK_NOT_FOUND = -32001;
export const TASK_NOT_CANCELABLE = -32002;
export const UNSUPPORTED_OPERATION = -32004;
export const VERSION_NOT_SUPPORTED = -32009;
/** Implementation defined (JSON-RPC server range, outside A2A's -32001..-32009): missing or invalid bearer. */
export const UNAUTHENTICATED = -32010;
/** Implementation defined: the caller's role may not call this skill. */
export const FORBIDDEN = -32011;

/** Which caller roles may invoke each skill. The token decides the role, never the message body. */
export const ALLOWED_CALLERS: Record<SkillId, readonly AgentRole[]> = {
  "platform.recipe": ["customer"],
  "platform.match_clinics": ["customer"],
  "platform.judge_quote": ["customer"],
  "platform.report_booking": ["clinic"],
  "platform.submit_outcome": ["customer"],
  "platform.report_signal": ["customer"],
  "clinic.offers": ["platform", "customer"],
  "clinic.quote": ["customer"],
  "clinic.availability": ["customer", "platform"],
  "clinic.book": ["customer"],
  "clinic.cancel": ["customer"],
  "customer.notify": ["clinic", "platform"],
  "customer.checkin": ["platform"],
};

const UNSUPPORTED_METHODS = new Set([
  "SendStreamingMessage",
  "SubscribeToTask",
  "ListTasks",
  "GetExtendedAgentCard",
  "CreateTaskPushNotificationConfig",
  "GetTaskPushNotificationConfig",
  "ListTaskPushNotificationConfigs",
  "DeleteTaskPushNotificationConfig",
]);

/** How long a SendMessage without returnImmediately waits for a WORKING task to settle (A2A 1.0 blocking). */
function blockingWaitMs(): number {
  const configured = Number(process.env.A2A_BLOCKING_WAIT_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : 15_000;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

class RpcFailure extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: unknown,
    readonly httpStatus = 200,
  ) {
    super(message);
  }
}

// ---- Agent Card ----

/**
 * GET handler body for an agent card. Customer cards need a valid bearer (03 endpoint table), others are
 * public. Unknown agent ids answer 404.
 */
export async function handleCardRequest(definition: AgentDefinition, req: Request, agentId: string): Promise<Response> {
  await ensureSeeded(getStore());
  if (definition.role === "customer") {
    const caller = await verifyAgentToken(req.headers.get("authorization"));
    if (!caller) return json({ error: "authentication required" }, 401, { "WWW-Authenticate": 'Bearer realm="pibu-a2a"' });
  }
  if (!(await definition.exists(agentId))) return json({ error: `unknown ${definition.role} agent: ${agentId}` }, 404);
  try {
    const card = await definition.card(agentId, publicBaseUrl(req.url));
    return json(card, 200, { "Cache-Control": definition.role === "customer" ? "private, no-store" : "public, max-age=60" });
  } catch (error) {
    console.error(`[a2a] ${definition.role} card failed`, error);
    return json({ error: "agent card unavailable" }, 503);
  }
}

// ---- JSON-RPC ----

/** POST handler body for an agent's JSON-RPC endpoint. `agentId` is already resolved by the route. */
export async function handleRpcRequest(definition: AgentDefinition, req: Request, agentId: string): Promise<Response> {
  const started = performance.now();
  await ensureSeeded(getStore());
  const self: AgentRef = { role: definition.role, agentId };

  const caller = await verifyAgentToken(req.headers.get("authorization"));
  if (!caller) {
    return json(jsonRpcError(null, UNAUTHENTICATED, "a valid agent bearer token is required"), 401, {
      "WWW-Authenticate": 'Bearer realm="pibu-a2a"',
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(jsonRpcError(null, PARSE_ERROR, "request body is not valid JSON"), 400);
  }

  const parsed = JsonRpcRequestSchema.safeParse(body);
  if (!parsed.success) return json(jsonRpcError(null, INVALID_REQUEST, "not a JSON-RPC 2.0 request"), 400);
  const rpc = parsed.data;

  let response: JsonRpcResponse;
  let httpStatus = 200;
  let task: WireTask | undefined;
  let skillId: SkillId | undefined;
  try {
    if (!(await definition.exists(agentId))) throw new RpcFailure(INVALID_REQUEST, `unknown ${definition.role} agent: ${agentId}`, undefined, 404);
    const version = req.headers.get("a2a-version");
    if (!version || !/^1(\.0)?(\.\d+)?$/.test(version.trim())) {
      throw new RpcFailure(VERSION_NOT_SUPPORTED, `A2A-Version ${version ?? "(missing, read as 0.3)"} is not supported, send A2A-Version: 1.0`);
    }
    const params = (rpc.params ?? {}) as Record<string, unknown>;
    switch (rpc.method) {
      case "SendMessage": {
        const out = await sendMessage(definition, self, caller, params);
        task = out.task;
        skillId = out.skillId;
        response = jsonRpcResult(rpc.id, { task });
        break;
      }
      case "GetTask": {
        const record = await accessibleTask(self, caller, params.id);
        task = record.task;
        skillId = record.skillId;
        response = jsonRpcResult(rpc.id, task);
        break;
      }
      case "CancelTask": {
        const record = await accessibleTask(self, caller, params.id);
        skillId = record.skillId;
        if (isTerminalState(record.task.status.state)) {
          throw new RpcFailure(TASK_NOT_CANCELABLE, `task ${record.id} is already ${record.task.status.state}`);
        }
        task = { ...record.task, status: { state: "TASK_STATE_CANCELED", timestamp: clock.nowIso() } };
        await saveTaskRecord({ ...record, task });
        response = jsonRpcResult(rpc.id, task);
        break;
      }
      default:
        if (UNSUPPORTED_METHODS.has(rpc.method)) throw new RpcFailure(UNSUPPORTED_OPERATION, `${rpc.method} is not supported by this agent`);
        throw new RpcFailure(METHOD_NOT_FOUND, `unknown method ${rpc.method}`);
    }
  } catch (error) {
    if (error instanceof RpcFailure) {
      response = jsonRpcError(rpc.id, error.code, error.message, error.data);
      httpStatus = error.httpStatus;
    } else {
      console.error(`[a2a] ${definition.role}:${agentId} ${rpc.method} failed`, error);
      response = jsonRpcError(rpc.id, INTERNAL_ERROR, "internal error");
    }
  }

  if (rpc.method === "SendMessage" || rpc.method === "GetTask" || rpc.method === "CancelTask") {
    const message = (rpc.params as { message?: { contextId?: unknown; metadata?: { skillId?: unknown } } } | undefined)?.message;
    const loggedSkill = skillId ?? (isSkillId(message?.metadata?.skillId) ? message?.metadata?.skillId : undefined);
    const contextId = task?.contextId ?? (typeof message?.contextId === "string" ? message.contextId : undefined);
    const entry: A2ALogEntry = {
      id: req.headers.get(LOG_ID_HEADER) || newId("log"),
      at: clock.nowIso(),
      ...(contextId ? { contextId } : {}),
      ...(task ? { taskId: task.id } : {}),
      from: { agentId: caller.agentId, role: caller.role },
      to: { agentId, role: definition.role, url: req.url },
      method: rpc.method,
      ...(loggedSkill ? { skillId: loggedSkill } : {}),
      request: body,
      response,
      ...(task ? { state: task.status.state } : {}),
      latencyMs: Math.round(performance.now() - started),
      humanSummary: humanSummaryFor(rpc.method, loggedSkill),
    };
    try {
      await recordA2ALog(getStore(), entry);
    } catch (error) {
      console.error("[a2a] failed to write log entry", error);
    }
  }

  return json(response, httpStatus);
}

async function accessibleTask(self: AgentRef, caller: AgentRef, id: unknown): Promise<TaskRecord> {
  if (typeof id !== "string" || id === "") throw new RpcFailure(INVALID_PARAMS, "params.id is required");
  const record = await loadTaskRecord(id);
  // A task that exists but belongs to another agent or caller is reported as not found (no probing).
  if (!record || !sameAgent(record.owner, self) || !sameAgent(record.caller, caller)) {
    throw new RpcFailure(TASK_NOT_FOUND, `task ${id} not found`);
  }
  return record;
}

async function sendMessage(
  definition: AgentDefinition,
  self: AgentRef,
  caller: AgentRef,
  params: Record<string, unknown>,
): Promise<{ task: WireTask; skillId: SkillId }> {
  const messageParse = WireMessageSchema.safeParse(params.message);
  if (!messageParse.success) {
    throw new RpcFailure(INVALID_PARAMS, "params.message is not a valid A2A message", {
      issues: messageParse.error.issues.map((i) => ({ path: i.path.map(String).join("."), code: i.code, message: i.message })),
    });
  }
  const message = messageParse.data;
  if (message.role !== "ROLE_USER") throw new RpcFailure(INVALID_PARAMS, "message.role must be ROLE_USER");
  const configuration = (params.configuration ?? {}) as { returnImmediately?: unknown };
  const returnImmediately = configuration.returnImmediately === true;

  const metadata = (message.metadata ?? {}) as Record<string, unknown>;
  const rawSkill = metadata.skillId;
  if (!isSkillId(rawSkill)) throw new RpcFailure(INVALID_PARAMS, `unknown skillId: ${String(rawSkill)}`);
  const skillId = rawSkill;
  const handler = definition.skills[skillId];
  if (!handler) throw new RpcFailure(INVALID_PARAMS, `skill ${skillId} is not offered by this ${definition.role} agent`);
  if (!ALLOWED_CALLERS[skillId].includes(caller.role)) {
    throw new RpcFailure(FORBIDDEN, `a ${caller.role} agent may not call ${skillId}`, undefined, 403);
  }

  let existing: TaskRecord | undefined;
  if (message.taskId !== undefined) {
    existing = await loadTaskRecord(message.taskId);
    if (!existing || !sameAgent(existing.owner, self) || !sameAgent(existing.caller, caller)) {
      throw new RpcFailure(TASK_NOT_FOUND, `task ${message.taskId} not found`);
    }
    if (isTerminalState(existing.task.status.state)) {
      throw new RpcFailure(UNSUPPORTED_OPERATION, `task ${existing.id} is already ${existing.task.status.state}`);
    }
    if (existing.skillId !== skillId) throw new RpcFailure(INVALID_PARAMS, `task ${existing.id} belongs to skill ${existing.skillId}`);
    if (existing.task.status.state !== "TASK_STATE_INPUT_REQUIRED") {
      throw new RpcFailure(INVALID_PARAMS, "taskId is only accepted to answer a task in TASK_STATE_INPUT_REQUIRED");
    }
    if (message.contextId !== undefined && message.contextId !== existing.task.contextId) {
      throw new RpcFailure(INVALID_PARAMS, "contextId does not match the task");
    }
  }

  const parse = parsePibuData(skillId, firstDataPart(message), existing ? { state: existing.task.status.state } : undefined);
  if (!parse.ok) throw new RpcFailure(parse.error.code, parse.error.message, parse.error.data);

  const contextId = existing?.task.contextId ?? message.contextId ?? newId("ctx");
  const taskId = existing?.id ?? newId("tsk");
  const now = clock.nowIso();
  const record: TaskRecord = existing
    ? { ...existing, task: { ...existing.task, status: { state: "TASK_STATE_WORKING", timestamp: now } } }
    : { id: taskId, owner: self, caller, skillId, task: newWireTask(taskId, contextId, "TASK_STATE_WORKING"), createdAt: now, updatedAt: now };
  await saveTaskRecord(record);

  const ctx: SkillContext = {
    caller,
    self,
    taskId,
    contextId,
    metadata,
    ...(existing ? { existingTaskState: existing.task.status.state } : {}),
  };

  let result: SkillResult;
  try {
    result = await handler(parse.data as Record<string, unknown>, ctx);
  } catch (error) {
    console.error(`[a2a] skill ${skillId} threw`, error);
    result = { state: "TASK_STATE_FAILED", text: "The agent could not process this request." };
  }

  // The handler may already have finished the task through taskCompleter (auto confirmation).
  const latest = (await loadTaskRecord(taskId)) ?? record;
  let task = latest.task;
  if (!isTerminalState(task.status.state)) {
    task = applySkillResult(task, skillId, result);
    await saveTaskRecord({ ...latest, task });
  }

  if (!returnImmediately && !isTerminalState(task.status.state) && !isInterruptedState(task.status.state)) {
    task = await waitForSettled(taskId, task, blockingWaitMs());
  }
  return { task, skillId };
}

/** A2A 1.0 return_immediately=false: hold the response until the task is terminal or interrupted (capped). */
async function waitForSettled(taskId: string, current: WireTask, maxMs: number): Promise<WireTask> {
  const deadline = performance.now() + maxMs;
  let task = current;
  while (performance.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    task = (await loadTaskRecord(taskId))?.task ?? task;
    if (isTerminalState(task.status.state) || isInterruptedState(task.status.state)) break;
  }
  return task;
}
