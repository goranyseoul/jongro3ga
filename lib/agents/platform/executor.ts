import { TaskState, type Message, type Part } from "@a2a-js/sdk";
import { AgentEvent, type AgentExecutor, type ExecutionEventBus, type RequestContext } from "@a2a-js/sdk/server";
import { agentTextMessage } from "../../a2a/stub-executor";
import { parsePibuData, SKILL_ROUTES, type SkillId } from "../../a2a/schemas";
import { clock } from "../../clock";
import type { AgentRole } from "../../domain";
import { judgeQuotes } from "./fairness";
import { matchClinics } from "./matching";
import { reportBooking, reportSignal, submitOutcome } from "./outcomes";
import { recipe } from "./recipe";
import type { SkillCaller, TextResult } from "./skill-result";
import { anchorRecord, submitVerifiedReview } from "./zk-skills";

// Platform agent executor, served at /a2a/platform/rpc (09 "AgentExecutor 공통 흐름"). The route has already
// checked the token, the skill routing, the caller's role and the input schema (lib/a2a/server.ts); this file
// dispatches the eight platform skills. SDK internal types only here (numeric TaskState, `content.$case` parts),
// never wire JSON (09 "SDK 함정" 1).

type SkillOutcome = { kind: "data"; data: Record<string, unknown> } | { kind: "text"; result: TextResult };

const ROLES: readonly AgentRole[] = ["customer", "platform", "clinic"];

/** The caller from the call context: `userName` is the token's sub, `role` is set by lib/a2a/server.ts AgentUser. */
function callerOf(ctx: RequestContext): SkillCaller | undefined {
  const user = ctx.context.user as ({ userName?: string; role?: unknown } & object) | undefined;
  const role = user?.role;
  if (!user?.userName || typeof role !== "string" || !ROLES.includes(role as AgentRole)) return undefined;
  return { agentId: user.userName, role: role as AgentRole };
}

function firstData(message: Message): unknown {
  for (const part of message.parts) if (part.content?.$case === "data") return part.content.value;
  return undefined;
}

async function runSkill(skillId: SkillId, data: unknown, caller: SkillCaller): Promise<SkillOutcome> {
  const parsed = parsePibuData(skillId, data);
  if (!parsed.ok) return { kind: "text", result: { state: "failed", text: parsed.error.message } };
  if (parsed.kind !== "input") return { kind: "text", result: { state: "failed", text: "platform skills take no input-response" } };
  switch (parsed.skillId) {
    case "platform.recipe":
      return { kind: "data", data: await recipe(parsed.data) };
    case "platform.match_clinics": {
      const result = await matchClinics(parsed.data, caller.agentId);
      return result.state === "completed" ? { kind: "data", data: result.shortlist } : { kind: "text", result: { state: result.state, text: result.reason } };
    }
    case "platform.judge_quote":
      return { kind: "data", data: await judgeQuotes(parsed.data) };
    case "platform.report_booking":
      return { kind: "text", result: await reportBooking(parsed.data, caller) };
    case "platform.submit_outcome":
      return { kind: "text", result: await submitOutcome(parsed.data, caller) };
    case "platform.report_signal":
      return { kind: "text", result: await reportSignal(parsed.data, caller) };
    case "platform.anchor_record":
      return { kind: "text", result: await anchorRecord(parsed.data, caller) };
    case "platform.submit_review":
      return { kind: "text", result: await submitVerifiedReview(parsed.data, caller) };
    default:
      return { kind: "text", result: { state: "failed", text: `skill ${parsed.skillId} is not a platform skill` } };
  }
}

const part = (content: NonNullable<Part["content"]>, mediaType: string): Part => ({ content, metadata: undefined, filename: "", mediaType });

const STATE = { completed: TaskState.TASK_STATE_COMPLETED, rejected: TaskState.TASK_STATE_REJECTED, failed: TaskState.TASK_STATE_FAILED } as const;

function finish(ctx: RequestContext, bus: ExecutionEventBus, skillId: string, outcome: SkillOutcome): void {
  const { taskId, contextId } = ctx;
  const done = outcome.kind === "data" || outcome.result.state === "completed";
  if (done) {
    const output = SKILL_ROUTES[skillId as SkillId]?.output ?? "text";
    bus.publish(
      AgentEvent.artifactUpdate({
        taskId,
        contextId,
        artifact: {
          artifactId: `art_${taskId}`,
          name: output === "text" ? skillId : output.replace(/^pibu\/|@\d+$/g, ""),
          description: "",
          parts: [
            outcome.kind === "data"
              ? part({ $case: "data", value: outcome.data }, "application/json")
              : part({ $case: "text", value: outcome.result.text }, "text/plain"),
          ],
          metadata: undefined,
          extensions: [],
        },
        append: false,
        lastChunk: true,
        metadata: undefined,
      }),
    );
  }
  const state = outcome.kind === "data" ? "completed" : outcome.result.state;
  bus.publish(
    AgentEvent.statusUpdate({
      taskId,
      contextId,
      status: {
        state: STATE[state],
        // Rejections and failures carry their reason in status.message (03 "에러 처리").
        message: outcome.kind === "text" && !done ? agentTextMessage(taskId, contextId, outcome.result.text) : undefined,
        timestamp: clock.nowIso(),
      },
      metadata: undefined,
    }),
  );
}

export const platformExecutor = (): AgentExecutor => ({
  async execute(ctx, bus) {
    const message = ctx.userMessage;
    const skillId = String(message.metadata?.skillId ?? "unknown");
    // The first event must be the task itself (09 "SDK 함정" 3).
    bus.publish(
      AgentEvent.task({
        id: ctx.taskId,
        contextId: ctx.contextId,
        status: { state: TaskState.TASK_STATE_WORKING, message: undefined, timestamp: clock.nowIso() },
        artifacts: [],
        history: [message],
        metadata: undefined,
      }),
    );
    const caller = callerOf(ctx);
    let outcome: SkillOutcome;
    if (!caller) {
      outcome = { kind: "text", result: { state: "rejected", text: "unauthenticated caller" } };
    } else {
      try {
        outcome = await runSkill(skillId as SkillId, firstData(message), caller);
      } catch (error) {
        outcome = { kind: "text", result: { state: "failed", text: `${skillId} failed: ${error instanceof Error ? error.message : String(error)}` } };
      }
    }
    finish(ctx, bus, skillId, outcome);
    bus.finished();
  },

  async cancelTask(taskId, bus) {
    // Every platform skill finishes within its request, so there is never a running task to stop.
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
});
