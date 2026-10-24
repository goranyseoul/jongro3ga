import type { I18nText, IsoDateTime } from "./common";

// Entities of the `shared` store namespace, docs/spec/06-data-model.md.

export type AgentRole = "customer" | "platform" | "clinic";

export interface A2ALogEntry {
  id: string;
  at: IsoDateTime;
  /** The customer request id. */
  contextId?: string;
  taskId?: string;
  from: { agentId: string; role: AgentRole };
  to: { agentId: string; role: AgentRole; url: string };
  method: "SendMessage" | "GetTask" | "CancelTask";
  skillId?: string;
  /** Full JSON-RPC request with sensitive fields masked (lib/a2a/mask.ts). */
  request: unknown;
  response?: unknown;
  /** State of the task in the response. */
  state?: string;
  latencyMs?: number;
  /** One line for the progress screen, e.g. "contacted 4 clinics". */
  humanSummary: I18nText;
}

export interface AgentIdentity {
  agentId: string;
  role: AgentRole;
  cardUrl: string;
  ownerId: string;
  tokenIssuedAt: IsoDateTime;
}
