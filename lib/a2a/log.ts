import type { A2ALogEntry, AgentRole, I18nText } from "../domain";
import type { Store } from "../store/types";
import { maskSensitive, type MaskOptions } from "./mask";

// A2A call log in the shared namespace (06-data-model.md "A2ALogEntry"). Only lib/a2a touches it.
const NAMESPACE = "shared";
const COLLECTION = "a2a_log";

/** Stores one call. Request and response are masked first; storing an existing id replaces it. */
export async function recordA2ALog(store: Store, entry: A2ALogEntry, mask?: MaskOptions): Promise<A2ALogEntry> {
  const stored: A2ALogEntry = {
    ...entry,
    request: maskSensitive(entry.request, mask),
    ...(entry.response === undefined ? {} : { response: maskSensitive(entry.response, mask) }),
  };
  await store.put(NAMESPACE, COLLECTION, stored);
  return stored;
}

export interface A2ALogFilter {
  contextId?: string;
  taskId?: string;
  skillId?: string;
  /** Task state of the response, e.g. "TASK_STATE_COMPLETED". */
  state?: string;
  method?: A2ALogEntry["method"];
  /** Matches the calling or the called agent. */
  agentId?: string;
  role?: AgentRole;
}

/** Oldest first. Calls with the same time keep the order they were recorded in. */
export async function listA2ALog(store: Store, filter: A2ALogFilter = {}): Promise<A2ALogEntry[]> {
  const { agentId, role, ...direct } = filter;
  const entries = await store.list<A2ALogEntry>(NAMESPACE, COLLECTION, direct);
  return entries
    .filter((e) => agentId === undefined || e.from.agentId === agentId || e.to.agentId === agentId)
    .filter((e) => role === undefined || e.from.role === role || e.to.role === role)
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => Date.parse(a.entry.at) - Date.parse(b.entry.at) || a.index - b.index)
    .map(({ entry }) => entry);
}

/** One step of what the agents did for a request, as the progress screen and the ops console show it. */
export interface AgentTimelineItem {
  id: string;
  at: string;
  /** The agent that made the call. */
  actor: { agentId: string; role: AgentRole };
  /** The agent that was called. */
  target: { agentId: string; role: AgentRole };
  skillId?: string;
  state?: string;
  latencyMs?: number;
  /** A sentence a person can read, per language. */
  summary: I18nText;
  /** The masked JSON-RPC exchange behind the sentence, shown when the row is expanded. */
  raw: { request: unknown; response?: unknown };
}

/** Everything the agents did for one customer request (contextId), in order. */
export async function agentTimeline(store: Store, contextId: string): Promise<AgentTimelineItem[]> {
  const entries = await listA2ALog(store, { contextId });
  return entries.map((entry) => ({
    id: entry.id,
    at: entry.at,
    actor: { agentId: entry.from.agentId, role: entry.from.role },
    target: { agentId: entry.to.agentId, role: entry.to.role },
    ...(entry.skillId === undefined ? {} : { skillId: entry.skillId }),
    ...(entry.state === undefined ? {} : { state: entry.state }),
    ...(entry.latencyMs === undefined ? {} : { latencyMs: entry.latencyMs }),
    summary: entry.humanSummary,
    raw: entry.response === undefined ? { request: entry.request } : { request: entry.request, response: entry.response },
  }));
}
