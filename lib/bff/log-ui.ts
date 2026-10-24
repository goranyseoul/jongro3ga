import type { A2ALogEntry } from "../ui-data/ops";

// Client safe: turns a stored A2ALogEntry (lib/a2a/log.ts, from /api/demo/log or /api/ops/a2a-log) into the row
// shape the ops log components render. No server imports here.

export type ServerLogEntry = Omit<A2ALogEntry, "humanSummary" | "state" | "contextId" | "taskId" | "skillId"> & {
  contextId?: string;
  taskId?: string;
  skillId?: string;
  state?: string;
  humanSummary: Partial<Record<"ko" | "ja" | "en" | "zh-CN", string>>;
};

export function toUiLogEntry(entry: ServerLogEntry): A2ALogEntry {
  return {
    ...entry,
    contextId: entry.contextId ?? "",
    taskId: entry.taskId ?? "",
    skillId: entry.skillId ?? "",
    state: (entry.state ?? "TASK_STATE_FAILED") as A2ALogEntry["state"],
    humanSummary: entry.humanSummary.ko ?? entry.humanSummary.en ?? "",
  };
}
