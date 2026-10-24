// A2A JSON-RPC client (09-architecture.md "A2A 클라이언트"). OWNER: track A2A core.
// Other tracks import these signatures now; until the core lands they throw so tests must mock them.
import type { SkillId } from "./schemas";
import type { WireTask } from "./wire";
import type { AgentRef } from "./contract";

export interface SendOptions {
  from: AgentRef;
  /** Agent Card URL of the callee. */
  toCardUrl: string;
  skillId: SkillId;
  data: Record<string, unknown>;
  text?: string;
  contextId: string;
  taskId?: string;
  metadata?: Record<string, unknown>;
  timeoutMs?: number;
  /** Defaults to true for clinic.book and customer.checkin (RETURN_IMMEDIATELY_SKILLS). */
  returnImmediately?: boolean;
}

export async function sendMessage(_options: SendOptions): Promise<WireTask> {
  throw new Error("a2a client not implemented yet (track A2A core)");
}

export async function getTask(_options: { from: AgentRef; toCardUrl: string; taskId: string }): Promise<WireTask> {
  throw new Error("a2a client not implemented yet (track A2A core)");
}

/** Card URL helpers so callers never hand-build paths (03-a2a-protocol.md endpoint table). */
export function cardUrl(baseUrl: string, ref: AgentRef): string {
  if (ref.role === "platform") return `${baseUrl}/a2a/platform/agent-card.json`;
  if (ref.role === "clinic") return `${baseUrl}/a2a/clinics/${ref.agentId}/agent-card.json`;
  return `${baseUrl}/a2a/customers/${ref.agentId}/agent-card.json`;
}
