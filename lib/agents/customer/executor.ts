import { TaskState, taskStateToJSON, type Artifact, type Message, type Task } from "@a2a-js/sdk";
import { AgentEvent, type AgentExecutor, type RequestContext } from "@a2a-js/sdk/server";
import {
  CheckinRequestV1Schema,
  OutcomeV1Schema,
  PIBU_SCHEMAS,
  parsePibuData,
  type CheckinRequestV1,
  type InputRequestV1,
  type InputResponseV1,
  type NotificationV1,
  type OutcomeV1,
} from "../../a2a/schemas";
import { clock } from "../../clock";
import type { AgentRole, Locale } from "../../domain";
import { agentDataMessage, agentTextMessage, dataArtifact, firstDataValue, textArtifact } from "./sdk";
import { customerStore, findBooking, newId, outcomeDraftId, type StoredBooking } from "./store";

// Customer agent executor, one per customer agent, served at /a2a/customers/{agentId}/rpc. The route has already
// checked the token, the 03 routing rules, the caller's role (customer.checkin: platform only) and the input
// schema (lib/a2a/server.ts). Two skills (02 1절 "A2A 스킬"):
//
//   customer.notify   store the pibu/notification@1, COMPLETED with a text confirmation
//   customer.checkin  COMPLETED with pibu/outcome@1 when the customer already answered that checkpoint, otherwise
//                     INPUT_REQUIRED with pibu/input-request@1 (the questions as fields); the platform's
//                     pibu/input-response@1 on the same task completes it
//
// The whole task goes out as the first and only event of a turn (09 "SDK 함정" 3).

type Outcome =
  | { state: "completed"; artifact: Artifact; text?: string }
  | { state: "input_required"; request: InputRequestV1; text: string }
  | { state: "failed"; reason: string };

interface Turn {
  ctx: RequestContext;
  agentId: string;
  caller: { agentId: string; role: AgentRole };
  metadata: Record<string, unknown>;
}

const SDK_STATE = {
  completed: TaskState.TASK_STATE_COMPLETED,
  input_required: TaskState.TASK_STATE_INPUT_REQUIRED,
  failed: TaskState.TASK_STATE_FAILED,
} as const;

const ROLES: readonly AgentRole[] = ["customer", "platform", "clinic"];

function callerOf(ctx: RequestContext): Turn["caller"] {
  const user = ctx.context.user as ({ userName?: string; role?: unknown } & object) | undefined;
  const role = typeof user?.role === "string" && ROLES.includes(user.role as AgentRole) ? (user.role as AgentRole) : "platform";
  return { agentId: user?.userName ?? "", role };
}

// ---- customer.notify ----

async function notify(turn: Turn, notification: NotificationV1): Promise<Outcome> {
  const account = await customerStore.accountByAgent(turn.agentId);
  if (!account) return { state: "failed", reason: `no customer behind ${turn.agentId}` };
  const id = newId("ntf");
  await customerStore.putNotification({
    id,
    customerId: account.id,
    from: { agentId: turn.caller.agentId, role: turn.caller.role },
    kind: notification.kind,
    ...(notification.bookingId ? { bookingId: notification.bookingId } : {}),
    text: notification.text,
    receivedAt: clock.nowIso(),
  });
  return { state: "completed", artifact: textArtifact(`art_${id}`, "notification", `received ${notification.kind} ${id}`) };
}

// ---- customer.checkin ----

const SATISFACTION_LABEL = {
  ko: "만족도 (1~5)",
  ja: "満足度(1~5)",
  en: "Satisfaction (1 to 5)",
  "zh-CN": "满意度(1~5)",
} satisfies Record<Locale, string>;

const questionKey = (index: number) => `q${index + 1}`;

function checkinFields(checkin: CheckinRequestV1, locale: Locale, only?: readonly string[]): InputRequestV1 {
  const fields: InputRequestV1["fields"] = [
    ...checkin.questions.map((question, i) => ({ key: questionKey(i), label: { [locale]: question }, sensitive: false })),
    { key: "satisfaction", label: SATISFACTION_LABEL, sensitive: false },
  ];
  return PIBU_SCHEMAS["pibu/input-request@1"].parse({
    schema: "pibu/input-request@1",
    fields: only ? fields.filter((f) => only.includes(f.key)) : fields,
  });
}

async function localeOf(agentId: string): Promise<Locale> {
  const account = await customerStore.accountByAgent(agentId);
  const profile = account ? await customerStore.profile(account.id) : undefined;
  return profile?.locale ?? "en";
}

/** The booking a check-in names, only if it belongs to this customer agent. */
async function bookingOf(agentId: string, wireBookingId: string): Promise<StoredBooking | undefined> {
  const booking = await findBooking(wireBookingId);
  const account = await customerStore.accountByAgent(agentId);
  return booking && account && booking.customerId === account.id ? booking : undefined;
}

async function checkin(turn: Turn, request: CheckinRequestV1): Promise<Outcome> {
  const booking = await bookingOf(turn.agentId, request.bookingId);
  if (!booking) return { state: "failed", reason: `unknown_booking: ${request.bookingId}` };
  const draft = await customerStore.outcomeDraft(outcomeDraftId(request.bookingId, request.checkpoint));
  if (draft?.outcome) {
    return { state: "completed", artifact: dataArtifact(`art_${draft.outcome.outcomeId}`, "outcome", draft.outcome) };
  }
  return {
    state: "input_required",
    request: checkinFields(request, await localeOf(turn.agentId)),
    text: `Waiting for the customer's ${request.checkpoint} answers`,
  };
}

/**
 * The outcome for a check-in answer: the questions' answers go into `comment`, satisfaction is the answer; the
 * paid price, amount and the rest stay what the customer reported at D0 (a check-in does not ask them again).
 */
async function checkinAnswer(turn: Turn, answer: InputResponseV1): Promise<Outcome> {
  const original = CheckinRequestV1Schema.safeParse(firstDataValue(turn.ctx.task?.history[0]));
  if (!original.success) return { state: "failed", reason: "the check-in request of this task is missing" };
  const checkin = original.data;
  const booking = await bookingOf(turn.agentId, checkin.bookingId);
  if (!booking?.booking) return { state: "failed", reason: `unknown_booking: ${checkin.bookingId}` };

  const satisfaction = Number.parseInt(answer.values.satisfaction ?? "", 10);
  if (!(satisfaction >= 1 && satisfaction <= 5)) {
    return { state: "input_required", request: checkinFields(checkin, await localeOf(turn.agentId), ["satisfaction"]), text: "Satisfaction 1 to 5 is still missing" };
  }
  const d0 = (await customerStore.outcomeDraft(outcomeDraftId(checkin.bookingId, "D0")))?.outcome;
  const account = await customerStore.accountByAgent(turn.agentId);
  const profile = account ? await customerStore.profile(account.id) : undefined;
  const quote = await customerStore.quote(booking.quoteId);
  const comment = checkin.questions
    .map((question, i) => `${question} ${answer.values[questionKey(i)] ?? ""}`.trim())
    .join(" / ");
  const outcome: OutcomeV1 = OutcomeV1Schema.parse({
    schema: "pibu/outcome@1",
    outcomeId: newId("out"),
    bookingId: checkin.bookingId,
    clinicId: booking.clinicId,
    procedureId: booking.procedureId,
    checkpoint: checkin.checkpoint,
    paidKrw: d0?.paidKrw ?? booking.booking.priceKrw,
    receivedAmount: d0?.receivedAmount ?? quote?.quote.amount ?? { value: 1, unit: "session" },
    productVerified: d0?.productVerified ?? "not_checked",
    receiptAttached: d0?.receiptAttached ?? false,
    satisfaction,
    painScore: d0?.painScore ?? 0,
    downtimeDaysActual: d0?.downtimeDaysActual ?? null,
    wouldReturn: d0?.wouldReturn ?? satisfaction >= 4,
    sideEffects: d0?.sideEffects ?? [],
    ...(comment ? { comment } : {}),
    visitorProfile: d0?.visitorProfile ?? (profile ? { nationality: profile.nationality, ageBand: profile.ageBand } : undefined),
    submittedAt: clock.nowIso(),
  });
  const id = outcomeDraftId(checkin.bookingId, checkin.checkpoint);
  const previous = await customerStore.outcomeDraft(id);
  await customerStore.putOutcomeDraft({
    id,
    bookingId: checkin.bookingId,
    checkpoint: checkin.checkpoint,
    dueAt: previous?.dueAt ?? clock.nowIso(),
    outcome,
    // The answer goes back to the platform in this very task.
    sentAt: clock.nowIso(),
  });
  return { state: "completed", artifact: dataArtifact(`art_${outcome.outcomeId}`, "outcome", outcome) };
}

// ---- dispatch ----

async function run(turn: Turn): Promise<Outcome> {
  const { ctx } = turn;
  const prior = ctx.task?.status ? { state: taskStateToJSON(ctx.task.status.state) } : undefined;
  const parsed = parsePibuData(turn.metadata.skillId, firstDataValue(ctx.userMessage), prior);
  if (!parsed.ok) return { state: "failed", reason: parsed.error.message };
  if (parsed.kind === "input_response") {
    return parsed.skillId === "customer.checkin" ? checkinAnswer(turn, parsed.data) : { state: "failed", reason: `${parsed.skillId} does not ask for input` };
  }
  switch (parsed.skillId) {
    case "customer.notify":
      return notify(turn, parsed.data);
    case "customer.checkin":
      return checkin(turn, parsed.data);
    default:
      return { state: "failed", reason: `skill ${parsed.skillId} is not a customer skill` };
  }
}

function statusMessage(taskId: string, contextId: string, outcome: Outcome): Message | undefined {
  switch (outcome.state) {
    case "completed":
      return outcome.text === undefined ? undefined : agentTextMessage(taskId, contextId, outcome.text);
    case "input_required":
      return agentDataMessage(taskId, contextId, outcome.request, outcome.text);
    case "failed":
      return agentTextMessage(taskId, contextId, outcome.reason);
  }
}

export const customerExecutor = (agentId: string): AgentExecutor => ({
  async execute(ctx, bus) {
    const message = ctx.userMessage;
    // A follow-up turn carries the original skillId (03 routing rule 3); the task's first message names it.
    const metadata = { ...(ctx.task?.history[0]?.metadata ?? {}), ...(message.metadata ?? {}) } as Record<string, unknown>;
    const turn: Turn = { ctx, agentId, caller: callerOf(ctx), metadata };

    let outcome: Outcome;
    try {
      outcome = await run(turn);
    } catch (error) {
      outcome = { state: "failed", reason: error instanceof Error ? error.message : String(error) };
    }
    const task: Task = {
      id: ctx.taskId,
      contextId: ctx.contextId,
      status: { state: SDK_STATE[outcome.state], message: statusMessage(ctx.taskId, ctx.contextId, outcome), timestamp: clock.nowIso() },
      artifacts: outcome.state === "completed" ? [outcome.artifact] : [],
      history: ctx.task ? [...ctx.task.history] : [message],
      metadata: ctx.task?.metadata,
    };
    bus.publish(AgentEvent.task(task));
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
});
