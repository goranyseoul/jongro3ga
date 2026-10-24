// Cross-track contract for the parallel build (docs/spec/BUILD-TRACKS.md).
// Agent tracks implement skill handlers against these types; the A2A core track turns an
// AgentDefinition into JSON-RPC routes (app/a2a/**) and implements the client in ./client.ts.
import type { SkillId } from "./schemas";
import type { TaskState } from "./wire";

export type AgentRole = "customer" | "platform" | "clinic";

export interface AgentRef {
  role: AgentRole;
  /** platform: "platform" · clinic: clinic id ("cln_mint") · customer: pseudonymous agent id ("cag_7f3k2") */
  agentId: string;
}

export interface SkillContext {
  /** Verified from the bearer token by the A2A core, never taken from the message body. */
  caller: AgentRef;
  /** The agent receiving the call (clinic slug or customer agent id resolved by the route). */
  self: AgentRef;
  taskId: string;
  contextId: string;
  /** message.metadata (skillId, referralToken, consentRef, ...) */
  metadata: Record<string, unknown>;
  /** Present when the call continues a task (input-response, GetTask polling handled by the core). */
  existingTaskState?: TaskState;
}

export interface SkillResult {
  state: Extract<
    TaskState,
    "TASK_STATE_COMPLETED" | "TASK_STATE_WORKING" | "TASK_STATE_INPUT_REQUIRED" | "TASK_STATE_REJECTED" | "TASK_STATE_FAILED"
  >;
  /** Becomes artifacts[0].parts[0].data (a pibu/*@1 object with its `schema` field). */
  data?: Record<string, unknown>;
  /** Becomes artifacts[0].parts[0].text when there is no data, or the status message text. */
  text?: string;
  /** For INPUT_REQUIRED: a pibu/input-request@1 object placed in status.message. */
  inputRequest?: Record<string, unknown>;
}

/** `data` is already validated by parsePibuData(skillId, ...) in the core before the handler runs. */
export type SkillHandler = (data: Record<string, unknown>, ctx: SkillContext) => Promise<SkillResult>;

export interface AgentDefinition {
  role: AgentRole;
  /** Agent Card JSON (03-a2a-protocol.md examples) for a given agent id, built with PUBLIC_BASE_URL. */
  card(agentId: string, baseUrl: string): Promise<Record<string, unknown>>;
  /** Whether this agent id exists (unknown clinic slug or customer id -> 404). */
  exists(agentId: string): Promise<boolean>;
  skills: Partial<Record<SkillId, SkillHandler>>;
}

/**
 * Lets the owner of a long-running task finish it later (clinic.book confirmed by staff or operator,
 * customer.checkin answered). Implemented by the A2A core over its task store.
 */
export interface TaskCompleter {
  complete(self: AgentRef, taskId: string, result: SkillResult): Promise<void>;
}
