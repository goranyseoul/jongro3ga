import { Role, TaskState, type Message } from "@a2a-js/sdk";
import { AgentEvent, type AgentExecutor } from "@a2a-js/sdk/server";
import { clock } from "../clock";

// T04 stub: every skill answers TASK_STATE_FAILED "not implemented". The agent executors under
// lib/agents/*/executor.ts start from this until their work package replaces them.
// Types here are the SDK's internal ones (numeric TaskState, `content.$case` parts), not wire JSON.

export function agentTextMessage(taskId: string, contextId: string, text: string): Message {
  return {
    messageId: crypto.randomUUID(),
    contextId,
    taskId,
    role: Role.ROLE_AGENT,
    parts: [{ content: { $case: "text", value: text }, metadata: undefined, filename: "", mediaType: "text/plain" }],
    metadata: undefined,
    extensions: [],
    referenceTaskIds: [],
  };
}

export function notImplementedExecutor(): AgentExecutor {
  return {
    async execute(ctx, bus) {
      const message = ctx.userMessage;
      const skillId = String(message.metadata?.skillId ?? "unknown");
      // The first event must be the task itself (09 "SDK 함정" 3).
      bus.publish(
        AgentEvent.task({
          id: ctx.taskId,
          contextId: ctx.contextId,
          status: { state: TaskState.TASK_STATE_SUBMITTED, message: undefined, timestamp: clock.nowIso() },
          artifacts: [],
          history: [message],
          metadata: undefined,
        }),
      );
      bus.publish(
        AgentEvent.statusUpdate({
          taskId: ctx.taskId,
          contextId: ctx.contextId,
          status: {
            state: TaskState.TASK_STATE_FAILED,
            message: agentTextMessage(ctx.taskId, ctx.contextId, `skill ${skillId} is not implemented`),
            timestamp: clock.nowIso(),
          },
          metadata: undefined,
        }),
      );
      bus.finished();
    },

    async cancelTask(taskId, bus) {
      bus.publish(
        AgentEvent.statusUpdate({
          taskId,
          contextId: "",
          status: { state: TaskState.TASK_STATE_CANCELED, message: undefined, timestamp: clock.nowIso() },
          metadata: undefined,
        }),
      );
      bus.finished();
    },
  };
}
