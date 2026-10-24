// Task persistence and late completion. OWNER: track A2A core.
import type { TaskCompleter } from "./contract";

export const taskCompleter: TaskCompleter = {
  async complete() {
    throw new Error("task completer not implemented yet (track A2A core)");
  },
};
