import { AgentCard, taskStateToJSON } from "@a2a-js/sdk";
import {
  DefaultExecutionEventBusManager,
  DefaultRequestHandler,
  InMemoryTaskStore,
  JsonRpcTransportHandler,
  ServerCallContext,
  validateVersion,
  type AgentExecutor,
  type User,
} from "@a2a-js/sdk/server";
import { clock } from "../clock";
import type { A2ALogEntry, AgentRole } from "../domain";
import { pibuGlobals } from "../pibu-globals";
import { getStore } from "../store";
import { verifyAgentToken, type Caller } from "./auth";
import { cardSkillIds, jsonRpcUrlOf, type AgentCardJson } from "./cards";
import { recordA2ALog } from "./log";
import { SKILL_CALLERS } from "./permissions";
import { isSkillId, parsePibuData, type SkillId } from "./schemas";
import { humanSummary, type SummaryOutcome } from "./summary";
import type { JsonRpcResponse, TaskState } from "./wire";

// The A2A JSON-RPC endpoint behind every app/a2a/** rpc route (09-architecture.md "A2A 서버 연결").
// SDK pieces (DefaultRequestHandler, InMemoryTaskStore, JsonRpcTransportHandler) do the protocol; this file
// adds what the SDK does not: agent token auth, the 03 skill routing rules, role permissions and the A2A log.
//
// The routing checks run before the SDK on purpose: once the SDK has the request, an executor that throws
// makes it synthesize a FAILED task, but 03 says a bad skillId or schema must create no task at all (-32602).

export const RPC_ERROR = {
  PARSE_ERROR: -32700,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  TASK_NOT_FOUND: -32001,
  UNSUPPORTED_OPERATION: -32004,
  VERSION_NOT_SUPPORTED: -32009,
  /** Server defined (JSON-RPC reserves -32000..-32099 for servers): no or bad agent token, HTTP 401. */
  UNAUTHORIZED: -32099,
  /** Server defined: the caller's role may not call the skill (lib/a2a/permissions.ts), HTTP 403. */
  FORBIDDEN: -32098,
} as const;

const DEFAULT_VERSION = "1.0";
const STREAMING_METHODS = new Set(["SendStreamingMessage", "SubscribeToTask"]);
const LOGGED_METHODS = new Set<A2ALogEntry["method"]>(["SendMessage", "GetTask", "CancelTask"]);

// ---- per agent state ----

/**
 * Task store of one agent instance ("platform", "clinic:mint", "customer:cag_7f3k2"). The SDK store scopes
 * tasks by caller (`context.user.userName`), so a task is only visible to the agent that created it: read
 * or write it with `callContextFor(<original caller agentId>, ...)`.
 */
export function taskStoreFor(agentKey: string): InMemoryTaskStore {
  const g = pibuGlobals();
  const stores = (g.taskStores ??= new Map());
  let store = stores.get(agentKey);
  if (!store) {
    store = new InMemoryTaskStore();
    stores.set(agentKey, store);
  }
  return store;
}

/** Event buses outlive one HTTP request when a task waits for input, so they are kept per agent too. */
export function eventBusManagerFor(agentKey: string): DefaultExecutionEventBusManager {
  const g = pibuGlobals();
  const managers = (g.eventBusManagers ??= new Map());
  let manager = managers.get(agentKey);
  if (!manager) {
    manager = new DefaultExecutionEventBusManager();
    managers.set(agentKey, manager);
  }
  return manager;
}

/** Drops every task store and event bus (demo reset, tests). */
export function resetTaskStores(): void {
  const g = pibuGlobals();
  g.taskStores?.clear();
  g.eventBusManagers?.clear();
}

/** The SDK user for an authenticated agent. `userName` is the agent id the task store scopes by. */
export class AgentUser implements User {
  constructor(
    readonly agentId: string,
    readonly role: AgentRole,
  ) {}
  get isAuthenticated(): boolean {
    return true;
  }
  get userName(): string {
    return this.agentId;
  }
}

/** Call context as `callerAgentId`. Pass the original caller's id to read or update its tasks out of band. */
export function callContextFor(
  callerAgentId: string,
  role: AgentRole,
  requestedVersion: string = DEFAULT_VERSION,
  requestedExtensions?: string[],
): ServerCallContext {
  return new ServerCallContext({
    // The SDK default is "0.3" (09 "SDK 함정" 2).
    requestedVersion,
    user: new AgentUser(callerAgentId, role),
    ...(requestedExtensions === undefined ? {} : { requestedExtensions }),
  });
}

// ---- route ----

type Params = Record<string, string>;

export interface RpcRouteConfig<P extends Params> {
  /** Role of the agent behind this route. */
  role: AgentRole;
  /** Task store key, e.g. "clinic:mint". */
  agentKey: (params: P) => string;
  /** Agent id for the log, e.g. "cln_mint". Undefined means no such agent (404). */
  agentId: (params: P) => string | undefined | Promise<string | undefined>;
  /** Wire Agent Card. Undefined means no such agent (404). */
  card: (params: P) => Promise<AgentCardJson | undefined>;
  executor: (params: P) => AgentExecutor | Promise<AgentExecutor>;
  /** Roles allowed to call a skill. Defaults to SKILL_CALLERS (02 "호출자"). */
  allowedCallers?: (skillId: SkillId) => readonly AgentRole[];
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);

function rpcIdOf(body: unknown): string | number | null {
  const id = isObject(body) ? body.id : undefined;
  return typeof id === "string" || typeof id === "number" ? id : null;
}

const rpcError = (id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  error: data === undefined ? { code, message } : { code, message, data },
});

/** Task inside a JSON-RPC result: `{ task }` for SendMessage, the task itself for GetTask and CancelTask. */
function taskOf(method: string, response: unknown): Json | undefined {
  if (!isObject(response) || !isObject(response.result)) return undefined;
  const result = response.result;
  const task = method === "SendMessage" ? result.task : result;
  return isObject(task) && typeof task.id === "string" ? task : undefined;
}

/** The skill a task was created for: metadata.skillId of the first message in its history. */
function skillOfTask(task: Json | undefined): string | undefined {
  const first = Array.isArray(task?.history) ? task.history[0] : undefined;
  const skillId = isObject(first) && isObject(first.metadata) ? first.metadata.skillId : undefined;
  return typeof skillId === "string" ? skillId : undefined;
}

function outcomeOf(response: unknown, task: Json | undefined): SummaryOutcome | undefined {
  if (isObject(response) && isObject(response.error)) {
    return response.error.code === RPC_ERROR.INVALID_PARAMS ? "invalid_params" : "rpc_error";
  }
  const state = isObject(task?.status) ? task.status.state : undefined;
  return typeof state === "string" ? (state as TaskState) : undefined;
}

interface Exchange {
  started: number;
  caller: Caller | null;
  target: { agentId: string; role: AgentRole; url: string };
  body: unknown;
}

async function logExchange(ex: Exchange, response: unknown, forced?: SummaryOutcome): Promise<void> {
  const method = isObject(ex.body) ? ex.body.method : undefined;
  if (typeof method !== "string" || !LOGGED_METHODS.has(method as A2ALogEntry["method"])) return;

  const params = isObject(ex.body) && isObject(ex.body.params) ? ex.body.params : {};
  const message = isObject(params.message) ? params.message : {};
  const metadata = isObject(message.metadata) ? message.metadata : {};
  const task = taskOf(method, response);
  const skillId = typeof metadata.skillId === "string" ? metadata.skillId : skillOfTask(task);
  const state = isObject(task?.status) && typeof task.status.state === "string" ? task.status.state : undefined;
  const contextId = typeof message.contextId === "string" ? message.contextId : (task?.contextId as string | undefined);
  const taskId =
    (task?.id as string | undefined) ??
    (typeof message.taskId === "string" ? message.taskId : typeof params.id === "string" ? params.id : undefined);

  const entry: A2ALogEntry = {
    id: `a2a_${crypto.randomUUID()}`,
    at: clock.nowIso(),
    ...(contextId === undefined ? {} : { contextId }),
    ...(taskId === undefined ? {} : { taskId }),
    // An unauthenticated caller has no verified identity; the role is a placeholder for the log type.
    from: ex.caller ?? { agentId: "unauthenticated", role: "customer" },
    to: ex.target,
    method: method as A2ALogEntry["method"],
    ...(skillId === undefined ? {} : { skillId }),
    request: ex.body,
    response,
    ...(state === undefined || forced !== undefined ? {} : { state }),
    latencyMs: Math.round(performance.now() - ex.started),
    humanSummary: humanSummary(skillId, forced ?? outcomeOf(response, task)),
  };
  await recordA2ALog(getStore(), entry);
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Checks 03 "스킬 라우팅 규칙" and role permissions for a SendMessage. Returns the error to answer with,
 * or undefined when the SDK may run the skill.
 */
async function checkSendMessage(
  body: Json,
  card: AgentCardJson,
  caller: Caller,
  agentKey: string,
  allowed: (skillId: SkillId) => readonly AgentRole[],
): Promise<{ status: number; response: JsonRpcResponse; outcome: SummaryOutcome } | undefined> {
  const id = rpcIdOf(body);
  const invalid = (message: string, data?: unknown) => ({
    status: 200,
    response: rpcError(id, RPC_ERROR.INVALID_PARAMS, message, data),
    outcome: "invalid_params" as const,
  });

  const params = isObject(body.params) ? body.params : undefined;
  const message = params && isObject(params.message) ? params.message : undefined;
  if (!message) return invalid("params.message is required");

  const skillId = isObject(message.metadata) ? message.metadata.skillId : undefined;
  if (skillId === undefined) return invalid("metadata.skillId is required");
  if (!isSkillId(skillId) || !cardSkillIds(card).includes(skillId)) {
    return invalid(`unknown skillId for this agent: ${String(skillId)}`);
  }

  if (!allowed(skillId).includes(caller.role)) {
    return {
      status: 403,
      response: rpcError(id, RPC_ERROR.FORBIDDEN, `forbidden: role ${caller.role} cannot call ${skillId}`),
      outcome: "forbidden",
    };
  }

  // Rule 3: a follow-up on an existing task is judged against that task's state and skill.
  let task: { state: string } | undefined;
  if (typeof message.taskId === "string" && message.taskId !== "") {
    const stored = await taskStoreFor(agentKey).load(message.taskId, callContextFor(caller.agentId, caller.role));
    if (stored) {
      const original = stored.history[0]?.metadata?.skillId;
      if (typeof original === "string" && original !== skillId) {
        return invalid(`task ${stored.id} belongs to ${original}, not ${skillId}`);
      }
      if (stored.status) task = { state: taskStateToJSON(stored.status.state) };
    }
  }

  const parts = Array.isArray(message.parts) ? message.parts : [];
  const dataPart = parts.find((part) => isObject(part) && "data" in part) as Json | undefined;
  const parsed = parsePibuData(skillId, dataPart?.data, task);
  if (!parsed.ok) return invalid(parsed.error.message, parsed.error.data);
  return undefined;
}

/**
 * Builds the POST handler of an A2A rpc route. Order: agent token (401), agent exists (404), A2A-Version
 * (-32009), JSON body (-32700), streaming methods (-32004), SendMessage routing and role checks (-32602,
 * 403), then the SDK. Every answered SendMessage, GetTask and CancelTask is logged once, rejections included.
 */
export function makeRpcRoute<P extends Params>(config: RpcRouteConfig<P>) {
  const allowed = config.allowedCallers ?? ((skillId: SkillId) => SKILL_CALLERS[skillId]);

  return async function POST(req: Request, ctx: { params: Promise<P> }): Promise<Response> {
    const started = performance.now();
    const params = await ctx.params;
    const [card, agentId] = await Promise.all([config.card(params), config.agentId(params)]);
    const caller = await verifyAgentToken(req.headers.get("authorization"));

    const raw = await req.text();
    let body: unknown;
    let parsedOk = true;
    try {
      body = JSON.parse(raw);
    } catch {
      parsedOk = false;
      body = raw;
    }
    const id = rpcIdOf(body);

    const target = card && agentId ? { agentId, role: config.role, url: jsonRpcUrlOf(card) ?? req.url } : undefined;
    const reply = async (response: unknown, status = 200, forced?: SummaryOutcome) => {
      if (target && parsedOk) await logExchange({ started, caller, target, body }, response, forced);
      return json(response, status);
    };

    if (!caller) return reply(rpcError(null, RPC_ERROR.UNAUTHORIZED, "unauthorized"), 401, "unauthorized");
    if (!card || !agentId) return json(rpcError(id, RPC_ERROR.METHOD_NOT_FOUND, "agent not found"), 404);

    const sdkCard = AgentCard.fromJSON(card);
    const version = req.headers.get("a2a-version")?.trim() || DEFAULT_VERSION;
    try {
      validateVersion(version, sdkCard, "JSONRPC");
    } catch (error) {
      return reply(rpcError(id, RPC_ERROR.VERSION_NOT_SUPPORTED, error instanceof Error ? error.message : "version not supported"));
    }

    if (!parsedOk || !isObject(body)) return json(rpcError(null, RPC_ERROR.PARSE_ERROR, "parse error"));

    const method = body.method;
    if (typeof method === "string" && STREAMING_METHODS.has(method)) {
      return reply(rpcError(id, RPC_ERROR.UNSUPPORTED_OPERATION, `${method} is not supported: this agent does not stream`));
    }

    const agentKey = config.agentKey(params);
    if (method === "SendMessage") {
      const rejected = await checkSendMessage(body, card, caller, agentKey, allowed);
      if (rejected) return reply(rejected.response, rejected.status, rejected.outcome);
    }

    const extensions = (req.headers.get("a2a-extensions") ?? "")
      .split(",")
      .map((uri) => uri.trim())
      .filter(Boolean);
    const context = callContextFor(caller.agentId, caller.role, version, extensions.length > 0 ? extensions : undefined);
    const executor = await config.executor(params);
    const handler = new JsonRpcTransportHandler(
      new DefaultRequestHandler(sdkCard, taskStoreFor(agentKey), executor, eventBusManagerFor(agentKey)),
    );
    const result = await handler.handle(body, context);
    if (Symbol.asyncIterator in result) {
      // Only streaming methods return a generator, and they were refused above.
      return reply(rpcError(id, RPC_ERROR.UNSUPPORTED_OPERATION, "streaming is not supported"));
    }
    return reply(result);
  };
}
