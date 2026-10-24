import { z } from "zod";
import { IsoDateTimeSchema, type SkillId } from "./schemas";

// A2A 1.0 JSON as it travels over HTTP (03-a2a-protocol.md). The SDK's internal types differ from this
// shape (09 "SDK 함정"), so clients and logs use these wire types and never the SDK ones.

// ---- task states ----

export const TASK_STATES = [
  "TASK_STATE_SUBMITTED",
  "TASK_STATE_WORKING",
  "TASK_STATE_INPUT_REQUIRED",
  "TASK_STATE_COMPLETED",
  "TASK_STATE_REJECTED",
  "TASK_STATE_FAILED",
  "TASK_STATE_CANCELED",
  "TASK_STATE_AUTH_REQUIRED",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

const TERMINAL = new Set<TaskState>(["TASK_STATE_COMPLETED", "TASK_STATE_REJECTED", "TASK_STATE_FAILED", "TASK_STATE_CANCELED"]);
const INTERRUPTED = new Set<TaskState>(["TASK_STATE_INPUT_REQUIRED", "TASK_STATE_AUTH_REQUIRED"]);

export const isTerminalState = (state: TaskState): boolean => TERMINAL.has(state);
export const isInterruptedState = (state: TaskState): boolean => INTERRUPTED.has(state);

/** What the customer sees for a task state (03 "태스크 상태 매핑"). null means never shown to the customer. */
export const TASK_STATE_COPY_KO: Record<TaskState, string | null> = {
  TASK_STATE_SUBMITTED: "요청을 보냈어요",
  TASK_STATE_WORKING: "병원에서 확인하고 있어요",
  TASK_STATE_INPUT_REQUIRED: "병원이 정보를 더 요청했어요",
  TASK_STATE_COMPLETED: "완료됐어요",
  TASK_STATE_REJECTED: "이 병원은 요청을 받을 수 없어요",
  TASK_STATE_FAILED: "문제가 생겼어요. 다시 시도할게요",
  TASK_STATE_CANCELED: "취소됐어요",
  TASK_STATE_AUTH_REQUIRED: null,
};

// ---- message, task ----

// Loose on purpose: other A2A implementations may add fields, we only rely on the ones below.
export const WirePartSchema = z
  .looseObject({
    text: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    mediaType: z.string().optional(),
  })
  .refine((part) => "text" in part || "data" in part || "raw" in part || "url" in part, "a part needs text, data, raw or url");

export const WireMessageSchema = z.looseObject({
  messageId: z.string().min(1),
  contextId: z.string().min(1).optional(),
  taskId: z.string().min(1).optional(),
  role: z.enum(["ROLE_USER", "ROLE_AGENT"]),
  parts: z.array(WirePartSchema).min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  extensions: z.array(z.string()).optional(),
});

export const WireTaskSchema = z.looseObject({
  id: z.string().min(1),
  contextId: z.string().min(1),
  status: z.looseObject({
    state: z.enum(TASK_STATES),
    message: WireMessageSchema.optional(),
    timestamp: IsoDateTimeSchema.optional(),
  }),
  artifacts: z
    .array(
      z.looseObject({
        artifactId: z.string().min(1),
        name: z.string().optional(),
        parts: z.array(WirePartSchema).min(1),
      }),
    )
    .optional(),
});

export type WirePart = z.infer<typeof WirePartSchema>;
export type WireMessage = z.infer<typeof WireMessageSchema>;
export type WireTask = z.infer<typeof WireTaskSchema>;

/** The first DataPart of a message, the only part the server trusts (03 rule 4). */
export function firstDataPart(message: Pick<WireMessage, "parts">): Record<string, unknown> | undefined {
  return message.parts.find((part) => part.data !== undefined)?.data;
}

/** Result of a data skill: artifacts[0].parts[0].data. */
export function taskArtifactData(task: Pick<WireTask, "artifacts">): Record<string, unknown> | undefined {
  return task.artifacts?.[0]?.parts[0]?.data;
}

/** Result of a text-only skill: artifacts[0].parts[0].text. */
export function taskArtifactText(task: Pick<WireTask, "artifacts">): string | undefined {
  return task.artifacts?.[0]?.parts[0]?.text;
}

/** SendMessage returns `{ task }`, GetTask returns the task itself (03 "응답 형태 규칙"). */
export function taskFromSendMessageResult(result: unknown): WireTask | undefined {
  const wrapped = z.object({ task: WireTaskSchema }).safeParse(result);
  return wrapped.success ? wrapped.data.task : undefined;
}

// ---- JSON-RPC 2.0 ----

export const JsonRpcIdSchema = z.union([z.string(), z.number()]);

export const JsonRpcRequestSchema = z.looseObject({
  jsonrpc: z.literal("2.0"),
  id: JsonRpcIdSchema,
  method: z.string().min(1),
  params: z.unknown().optional(),
});

export const JsonRpcErrorSchema = z.looseObject({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});

export const JsonRpcResponseSchema = z.union([
  z.looseObject({ jsonrpc: z.literal("2.0"), id: JsonRpcIdSchema.nullable(), result: z.unknown() }),
  z.looseObject({ jsonrpc: z.literal("2.0"), id: JsonRpcIdSchema.nullable(), error: JsonRpcErrorSchema }),
]);

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

export const jsonRpcResult = (id: string | number | null, result: unknown): JsonRpcResponse => ({
  jsonrpc: "2.0",
  id,
  result,
});

export const jsonRpcError = (
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcResponse => ({ jsonrpc: "2.0", id, error: data === undefined ? { code, message } : { code, message, data } });

// ---- SendMessage request ----

/** Skills a human confirms later: the caller must not wait for the HTTP response (03 "응답 형태 규칙"). */
export const RETURN_IMMEDIATELY_SKILLS: ReadonlySet<SkillId> = new Set<SkillId>(["clinic.book", "customer.checkin"]);

export interface SendMessageOptions {
  rpcId: string | number;
  messageId: string;
  /** The customer request id: every task of one request shares it. */
  contextId: string;
  /** Set to continue an existing task, e.g. to answer INPUT_REQUIRED. */
  taskId?: string;
  skillId: SkillId;
  data: Record<string, unknown>;
  /** Human readable line for logs, never trusted by the server. */
  text?: string;
  /** Extra metadata such as referralToken or consentRef. skillId cannot be overridden. */
  metadata?: Record<string, unknown>;
  extensions?: string[];
  returnImmediately?: boolean;
}

export function buildSendMessageRequest(options: SendMessageOptions): JsonRpcRequest {
  const needsImmediate = RETURN_IMMEDIATELY_SKILLS.has(options.skillId);
  if (needsImmediate && options.returnImmediately === false) {
    throw new Error(`${options.skillId} must be sent with returnImmediately: true`);
  }

  const parts: WirePart[] = [];
  if (options.text !== undefined) parts.push({ text: options.text });
  parts.push({ data: options.data, mediaType: "application/json" });

  const message: Record<string, unknown> = {
    messageId: options.messageId,
    contextId: options.contextId,
    ...(options.taskId === undefined ? {} : { taskId: options.taskId }),
    role: "ROLE_USER",
    parts,
    metadata: { ...options.metadata, skillId: options.skillId },
    ...(options.extensions === undefined ? {} : { extensions: options.extensions }),
  };

  const configuration: Record<string, unknown> = { acceptedOutputModes: ["application/json", "text/plain"] };
  if (needsImmediate || options.returnImmediately === true) configuration.returnImmediately = true;

  return { jsonrpc: "2.0", id: options.rpcId, method: "SendMessage", params: { message, configuration } };
}
