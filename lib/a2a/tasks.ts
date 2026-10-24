// Task persistence and late completion. OWNER: track A2A core.
//
// Tasks live in the `shared` store namespace (collection "a2a_tasks") through getStore(), not in process
// memory, so GetTask polling keeps working across serverless instances once the store is Postgres.
// Every task records its owner (the agent that answers) and its caller (from the verified bearer token):
// GetTask and CancelTask only show a task to that caller, completion only comes from that owner.
import { clock } from "../clock";
import { getStore } from "../store";
import type { AgentRef, SkillResult, TaskCompleter } from "./contract";
import { SKILL_ROUTES, type SkillId } from "./schemas";
import { isTerminalState, type TaskState, type WireMessage, type WireTask } from "./wire";

const NAMESPACE = "shared";
const COLLECTION = "a2a_tasks";

export interface TaskRecord {
  /** = task.id */
  id: string;
  owner: AgentRef;
  caller: AgentRef;
  skillId: SkillId;
  task: WireTask;
  createdAt: string;
  updatedAt: string;
}

export const newId = (prefix: string): string => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

export const sameAgent = (a: AgentRef, b: AgentRef): boolean => a.role === b.role && a.agentId === b.agentId;

export async function loadTaskRecord(taskId: string): Promise<TaskRecord | undefined> {
  return getStore().get<TaskRecord>(NAMESPACE, COLLECTION, taskId);
}

export async function saveTaskRecord(record: TaskRecord): Promise<void> {
  await getStore().put(NAMESPACE, COLLECTION, { ...record, updatedAt: clock.nowIso() });
}

/** Tasks owned by one agent, oldest first (consoles that list pending work). */
export async function listTaskRecords(owner: AgentRef): Promise<TaskRecord[]> {
  const all = await getStore().list<TaskRecord>(NAMESPACE, COLLECTION);
  return all.filter((r) => sameAgent(r.owner, owner));
}

function artifactName(skillId: SkillId): string {
  const output = SKILL_ROUTES[skillId].output;
  return output === "text" ? "confirmation" : output.replace(/^pibu\//, "").replace(/@\d+$/, "");
}

function agentMessage(task: Pick<WireTask, "id" | "contextId">, parts: WireMessage["parts"]): WireMessage {
  return { messageId: newId("msg"), contextId: task.contextId, taskId: task.id, role: "ROLE_AGENT", parts };
}

/**
 * Writes a skill result onto a task (03 "응답 형태 규칙"): data goes to artifacts[0].parts[0].data,
 * a text-only result to artifacts[0].parts[0].text. REJECTED / FAILED text goes to status.message,
 * INPUT_REQUIRED carries the pibu/input-request@1 DataPart in status.message.
 */
export function applySkillResult(task: WireTask, skillId: SkillId, result: SkillResult): WireTask {
  const next: WireTask = { ...task, status: { state: result.state, timestamp: clock.nowIso() } };
  const isOutcomeState = result.state === "TASK_STATE_COMPLETED" || result.state === "TASK_STATE_WORKING";

  if (result.data !== undefined && isOutcomeState) {
    next.artifacts = [
      { artifactId: newId("art"), name: artifactName(skillId), parts: [{ data: result.data, mediaType: "application/json" }] },
    ];
  } else if (result.text !== undefined && result.state === "TASK_STATE_COMPLETED") {
    next.artifacts = [{ artifactId: newId("art"), name: artifactName(skillId), parts: [{ text: result.text }] }];
  }

  if (result.state === "TASK_STATE_INPUT_REQUIRED" && result.inputRequest) {
    const parts: WireMessage["parts"] = [];
    if (result.text) parts.push({ text: result.text });
    parts.push({ data: result.inputRequest, mediaType: "application/json" });
    next.status.message = agentMessage(task, parts);
  } else if (result.text !== undefined && !(result.state === "TASK_STATE_COMPLETED" && next.artifacts?.[0]?.parts[0]?.text)) {
    next.status.message = agentMessage(task, [{ text: result.text }]);
  }
  return next;
}

export function newWireTask(taskId: string, contextId: string, state: TaskState = "TASK_STATE_SUBMITTED"): WireTask {
  return { id: taskId, contextId, status: { state, timestamp: clock.nowIso() } };
}

export class TaskAccessError extends Error {
  constructor(
    message: string,
    readonly reason: "not_found" | "not_owner" | "terminal",
  ) {
    super(message);
    this.name = "TaskAccessError";
  }
}

export const taskCompleter: TaskCompleter = {
  /**
   * Finishes a task the owner left WORKING or INPUT_REQUIRED (clinic.book after staff or operator
   * confirmation, customer.checkin after the customer answered). The caller sees it on its next GetTask.
   */
  async complete(self, taskId, result) {
    const record = await loadTaskRecord(taskId);
    if (!record) throw new TaskAccessError(`task ${taskId} not found`, "not_found");
    if (!sameAgent(record.owner, self)) {
      throw new TaskAccessError(`task ${taskId} belongs to ${record.owner.role}:${record.owner.agentId}`, "not_owner");
    }
    if (isTerminalState(record.task.status.state)) {
      throw new TaskAccessError(`task ${taskId} is already ${record.task.status.state}`, "terminal");
    }
    await saveTaskRecord({ ...record, task: applySkillResult(record.task, record.skillId, result) });
  },
};
