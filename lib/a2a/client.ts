import { clock } from "../clock";
import type { A2ALogEntry, AgentRole } from "../domain";
import { pibuGlobals } from "../pibu-globals";
import { getStore } from "../store";
import { PLATFORM_AGENT_ID } from "../store/collections";
import { issueAgentToken } from "./auth";
import { jsonRpcUrlOf, type AgentCardJson } from "./cards";
import { recordA2ALog } from "./log";
import type { SkillId } from "./schemas";
import { humanSummary } from "./summary";
import { WireTaskSchema, buildSendMessageRequest, taskFromSendMessageResult, type JsonRpcRequest, type WireTask } from "./wire";

// Thin fetch client for agent to agent calls (09-architecture.md "A2A 클라이언트"). It speaks wire JSON only.
//
// Logging: the rpc route logs every call it answers (lib/a2a/server.ts), so the client does not log those
// again. It logs only failures the server never sees: timeouts, network errors and replies that are not
// JSON. Those entries have no `state` (BUILD-LOG 19).

export interface AgentRef {
  agentId: string;
  role: AgentRole;
}

export type A2AClientErrorKind = "rpc" | "timeout" | "network" | "http" | "invalid_response";

export class A2AClientError extends Error {
  readonly kind: A2AClientErrorKind;
  /** JSON-RPC error code, when the reply carried one. */
  readonly code?: number;
  readonly data?: unknown;
  /** HTTP status, for "http" and "invalid_response". */
  readonly status?: number;

  constructor(kind: A2AClientErrorKind, message: string, extra: { code?: number; data?: unknown; status?: number } = {}) {
    super(message);
    this.name = "A2AClientError";
    this.kind = kind;
    if (extra.code !== undefined) this.code = extra.code;
    if (extra.data !== undefined) this.data = extra.data;
    if (extra.status !== undefined) this.status = extra.status;
  }
}

interface CallOptions {
  from: AgentRef;
  /** Agent Card URL of the agent to call; the client picks its JSONRPC 1.0 interface. */
  toCardUrl: string;
  /** Whole call deadline, card lookup included. Default 20000 (03 "에러 처리"). */
  timeoutMs?: number;
  /** Defaults to globalThis.fetch. Tests pass lib/a2a/__fixtures__/route-fetch.ts to skip the network. */
  fetchImpl?: typeof fetch;
}

export interface SendMessageOpts extends CallOptions {
  skillId: SkillId;
  /** The pibu/*@1 object for the first DataPart. */
  data: Record<string, unknown>;
  /** Human readable line for logs, never trusted by the server. */
  text?: string;
  /** The customer request id. */
  contextId: string;
  /** Continue an existing task, e.g. to answer INPUT_REQUIRED. */
  taskId?: string;
  /** referralToken, consentRef, offerProof. skillId is set by the client. */
  metadata?: Record<string, unknown>;
  /** Extension URIs used by this message: sent in message.extensions and the A2A-Extensions header. */
  extensions?: string[];
  /** Required true for clinic.book and customer.checkin (03 "응답 형태 규칙"); set automatically for them. */
  returnImmediately?: boolean;
}

export interface GetTaskOpts extends CallOptions {
  taskId: string;
  /** Only used to file a client side failure under the right request and skill. */
  contextId?: string;
  skillId?: SkillId;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const CARD_TTL_MS = 60_000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Which agent a URL belongs to, from the 03 URL layout. Used to label client side failures. */
export function agentFromUrl(url: string): { agentId: string; role: AgentRole } {
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  let m: RegExpExecArray | null;
  if ((m = /\/a2a\/clinics\/([^/]+)\//.exec(path))) return { agentId: `cln_${m[1].replace(/-/g, "_")}`, role: "clinic" };
  if ((m = /\/a2a\/customers\/([^/]+)\//.exec(path))) return { agentId: m[1], role: "customer" };
  if (/\/a2a\/platform\/|\/\.well-known\//.test(path)) return { agentId: PLATFORM_AGENT_ID, role: "platform" };
  return { agentId: "unknown", role: "platform" };
}

/** Deadline shared by every fetch of one call. */
function deadline(timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, done: () => clearTimeout(timer), timedOut: () => controller.signal.aborted };
}

async function doFetch(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  timedOut: () => boolean,
): Promise<Response> {
  try {
    return await fetchImpl(url, { ...init, signal });
  } catch (error) {
    if (timedOut()) throw new A2AClientError("timeout", `no response from ${url}`);
    throw new A2AClientError("network", `request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function readJson(res: Response, url: string, timedOut: () => boolean): Promise<unknown> {
  let text: string;
  try {
    text = await res.text();
  } catch (error) {
    if (timedOut()) throw new A2AClientError("timeout", `no response from ${url}`);
    throw new A2AClientError("network", `reading ${url} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new A2AClientError("invalid_response", `${url} did not answer JSON (HTTP ${res.status})`, { status: res.status });
  }
}

async function getCard(
  url: string,
  opts: { from?: AgentRef; fetchImpl?: typeof fetch },
  signal: AbortSignal,
  timedOut: () => boolean,
): Promise<AgentCardJson> {
  const cache = (pibuGlobals().agentCardCache ??= new Map());
  const hit = cache.get(url);
  if (hit && Date.now() - hit.fetchedAt < CARD_TTL_MS) return hit.card as AgentCardJson;

  const headers: Record<string, string> = { Accept: "application/json" };
  // Customer cards are not public (03): any agent token opens them.
  if (opts.from) headers.Authorization = `Bearer ${await issueAgentToken(opts.from)}`;
  const res = await doFetch(opts.fetchImpl ?? fetch, url, { method: "GET", headers }, signal, timedOut);
  const body = await readJson(res, url, timedOut);
  if (!res.ok) throw new A2AClientError("http", `agent card ${url} answered HTTP ${res.status}`, { status: res.status });
  if (!isObject(body) || !Array.isArray(body.supportedInterfaces)) {
    throw new A2AClientError("invalid_response", `${url} is not an Agent Card`, { status: res.status });
  }
  cache.set(url, { fetchedAt: Date.now(), card: body });
  return body as unknown as AgentCardJson;
}

/** An Agent Card, cached 60 seconds per URL. Pass `from` for customer cards, which need a token. */
export async function fetchAgentCard(
  url: string,
  opts: { from?: AgentRef; fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<AgentCardJson> {
  const d = deadline(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    return await getCard(url, opts, d.signal, d.timedOut);
  } finally {
    d.done();
  }
}

/** Forgets every cached card (demo reset, tests). */
export function clearAgentCardCache(): void {
  pibuGlobals().agentCardCache?.clear();
}

interface CallLog {
  from: AgentRef;
  toCardUrl: string;
  method: A2ALogEntry["method"];
  skillId?: string;
  contextId?: string;
  taskId?: string;
  request: JsonRpcRequest;
}

/** Records a failure the server could not see. */
async function logClientFailure(call: CallLog, rpcUrl: string | undefined, started: number): Promise<void> {
  const target = agentFromUrl(rpcUrl ?? call.toCardUrl);
  const entry: A2ALogEntry = {
    id: `a2a_${crypto.randomUUID()}`,
    at: clock.nowIso(),
    ...(call.contextId === undefined ? {} : { contextId: call.contextId }),
    ...(call.taskId === undefined ? {} : { taskId: call.taskId }),
    from: { agentId: call.from.agentId, role: call.from.role },
    to: { ...target, url: rpcUrl ?? call.toCardUrl },
    method: call.method,
    ...(call.skillId === undefined ? {} : { skillId: call.skillId }),
    request: call.request,
    latencyMs: Math.round(performance.now() - started),
    humanSummary: humanSummary(call.skillId, "no_response"),
  };
  await recordA2ALog(getStore(), entry);
}

async function call(opts: CallOptions, log: Omit<CallLog, "from" | "toCardUrl">, extensions?: string[]): Promise<unknown> {
  const started = performance.now();
  const d = deadline(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let rpcUrl: string | undefined;
  try {
    const card = await getCard(opts.toCardUrl, opts, d.signal, d.timedOut);
    rpcUrl = jsonRpcUrlOf(card);
    if (!rpcUrl) throw new A2AClientError("invalid_response", `${opts.toCardUrl} has no JSONRPC 1.0 interface`);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "A2A-Version": "1.0",
      Authorization: `Bearer ${await issueAgentToken(opts.from)}`,
    };
    if (extensions && extensions.length > 0) headers["A2A-Extensions"] = extensions.join(",");

    const res = await doFetch(
      opts.fetchImpl ?? fetch,
      rpcUrl,
      { method: "POST", headers, body: JSON.stringify(log.request) },
      d.signal,
      d.timedOut,
    );
    const body = await readJson(res, rpcUrl, d.timedOut);
    const error = isObject(body) && isObject(body.error) ? body.error : undefined;
    const fields = error
      ? { code: typeof error.code === "number" ? error.code : undefined, data: error.data }
      : {};
    if (!res.ok) {
      throw new A2AClientError("http", `${rpcUrl} answered HTTP ${res.status}${error ? `: ${String(error.message)}` : ""}`, {
        ...fields,
        status: res.status,
      });
    }
    if (error) throw new A2AClientError("rpc", String(error.message ?? "JSON-RPC error"), fields);
    if (!isObject(body) || !("result" in body)) throw new A2AClientError("invalid_response", `${rpcUrl} sent no JSON-RPC result`);
    return body.result;
  } catch (error) {
    const failure =
      error instanceof A2AClientError ? error : new A2AClientError("network", error instanceof Error ? error.message : String(error));
    if (failure.kind === "timeout" || failure.kind === "network" || (failure.kind === "invalid_response" && failure.status !== undefined)) {
      await logClientFailure({ ...log, from: opts.from, toCardUrl: opts.toCardUrl }, rpcUrl, started);
    }
    throw failure;
  } finally {
    d.done();
  }
}

/** SendMessage to another agent; returns `result.task` (03 "응답 형태 규칙"). */
export async function sendMessage(opts: SendMessageOpts): Promise<WireTask> {
  const request = buildSendMessageRequest({
    rpcId: `rpc_${crypto.randomUUID()}`,
    messageId: `msg_${crypto.randomUUID()}`,
    contextId: opts.contextId,
    ...(opts.taskId === undefined ? {} : { taskId: opts.taskId }),
    skillId: opts.skillId,
    data: opts.data,
    ...(opts.text === undefined ? {} : { text: opts.text }),
    ...(opts.metadata === undefined ? {} : { metadata: opts.metadata }),
    ...(opts.extensions === undefined ? {} : { extensions: opts.extensions }),
    ...(opts.returnImmediately === undefined ? {} : { returnImmediately: opts.returnImmediately }),
  });
  const result = await call(
    opts,
    { method: "SendMessage", skillId: opts.skillId, contextId: opts.contextId, taskId: opts.taskId, request },
    opts.extensions,
  );
  const task = taskFromSendMessageResult(result);
  if (!task) throw new A2AClientError("invalid_response", "SendMessage result has no task");
  return task;
}

/** GetTask on another agent; the result is the task itself. Only the agent that created a task can read it. */
export async function getTask(opts: GetTaskOpts): Promise<WireTask> {
  const request: JsonRpcRequest = {
    jsonrpc: "2.0",
    id: `rpc_${crypto.randomUUID()}`,
    method: "GetTask",
    params: { id: opts.taskId },
  };
  const result = await call(opts, { method: "GetTask", skillId: opts.skillId, contextId: opts.contextId, taskId: opts.taskId, request });
  const parsed = WireTaskSchema.safeParse(result);
  if (!parsed.success) throw new A2AClientError("invalid_response", "GetTask result is not a task");
  return parsed.data;
}
