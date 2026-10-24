import { TaskState, taskStateToJSON, type Artifact, type Message, type Task } from "@a2a-js/sdk";
import { AgentEvent, type AgentExecutor, type RequestContext } from "@a2a-js/sdk/server";
import { verifyReferralToken, type ReferralClaims } from "../../a2a/auth";
import {
  PIBU_SCHEMAS,
  parsePibuData,
  type AvailabilityQueryV1,
  type BookingRequestV1,
  type CancelRequestV1,
  type InputRequestV1,
  type InputResponseV1,
  type OffersQueryV1,
  type ProcedureRequestV1,
  type QuoteV1,
} from "../../a2a/schemas";
import { clock } from "../../clock";
import type { ClinicRegistryEntry, Locale } from "../../domain";
import { buildAvailability } from "./availability";
import { cancelBooking, markConfirmed, reportBooking } from "./booking";
import { checkOfferProof } from "./offer-proof";
import { buildOffers } from "./offers";
import { decideQuote } from "./quote";
import { agentDataMessage, agentTextMessage, dataArtifact, firstDataValue, newId } from "./sdk";
import {
  clinicTaskId,
  findBookingByTask,
  findIssuedQuote,
  getSlotPolicy,
  listMenu,
  listOffers,
  listSlots,
  putBooking,
  putClinicTask,
  setSlotHeld,
  type ClinicBookingRecord,
} from "./store";

// Clinic agent executor, one per clinic, served at /a2a/clinics/{slug}/rpc. The route has already checked the
// 03 routing rules, the caller's role and the input schema (lib/a2a/server.ts); this file runs the five skills of
// 02 section 3 on the clinic namespace and answers with one task event (09 "AgentExecutor 공통 흐름"):
//
//   clinic.offers        COMPLETED, pibu/offers@1
//   clinic.quote         COMPLETED, pibu/quote@1 (referral token, offer proof, 07 item rules) or REJECTED
//   clinic.availability  COMPLETED, pibu/availability@1
//   clinic.book          WORKING until confirmed (booking.ts), COMPLETED at once for an autoConfirm clinic,
//                        INPUT_REQUIRED when the request lacks safety info, REJECTED for a bad token, quote or slot
//   clinic.cancel        COMPLETED, pibu/booking@1 canceled, or REJECTED
//
// The whole task goes out as the first and only event, so a returnImmediately caller gets the final state of
// this turn (WORKING, INPUT_REQUIRED or COMPLETED) and not a SUBMITTED snapshot.

type Outcome =
  | { state: "completed"; artifact: Artifact; summary: string; quote?: QuoteV1; text?: string }
  | { state: "working"; text: string; summary: string }
  | { state: "input_required"; request: InputRequestV1; text: string; summary: string }
  | { state: "rejected"; reason: string }
  | { state: "failed"; reason: string };

interface Turn {
  clinic: ClinicRegistryEntry;
  ctx: RequestContext;
  /** The calling agent's id: the task store scopes tasks by it. */
  caller: string;
  metadata: Record<string, unknown>;
}

const SDK_STATE = {
  completed: TaskState.TASK_STATE_COMPLETED,
  working: TaskState.TASK_STATE_WORKING,
  input_required: TaskState.TASK_STATE_INPUT_REQUIRED,
  rejected: TaskState.TASK_STATE_REJECTED,
  failed: TaskState.TASK_STATE_FAILED,
} as const;

const localesOf = (clinic: ClinicRegistryEntry): Locale[] => clinic.languages.map((l) => l.locale);

// ---- referral token (03 "인증과 신뢰", referral extension) ----

type ReferralCheck = { ok: true; token: string; claims: ReferralClaims } | { ok: false; reason: string };

/** clinic.quote and clinic.book need a platform referral token for this clinic. The reason is the status text. */
async function checkReferral(raw: unknown, clinicId: string, scope: "quote" | "book"): Promise<ReferralCheck> {
  if (typeof raw !== "string" || raw === "") return { ok: false, reason: "referral_token_missing" };
  const result = await verifyReferralToken(raw, { clinicId });
  if ("error" in result) return { ok: false, reason: `referral_token_${result.error}` };
  if (!result.scope.includes(scope)) return { ok: false, reason: "referral_token_scope" };
  return { ok: true, token: raw, claims: result };
}

// ---- skills ----

async function offers(turn: Turn, query: OffersQueryV1): Promise<Outcome> {
  const { clinic } = turn;
  const month = query.month ?? clock.today().slice(0, 7);
  const [menu, events] = await Promise.all([listMenu(clinic.id), listOffers(clinic.id)]);
  const result = PIBU_SCHEMAS["pibu/offers@1"].parse(buildOffers({ clinicId: clinic.id, menu, offers: events, month }));
  return {
    state: "completed",
    artifact: dataArtifact(`art_offers_${clinic.id}_${month}`, "offers", result),
    summary: `offers ${month}: ${result.items.length} items`,
  };
}

async function quote(turn: Turn, request: ProcedureRequestV1): Promise<Outcome> {
  const { clinic } = turn;
  const referral = await checkReferral(turn.metadata.referralToken, clinic.id, "quote");
  if (!referral.ok) return { state: "rejected", reason: referral.reason };

  const today = clock.today();
  const [menu, events, slots] = await Promise.all([listMenu(clinic.id), listOffers(clinic.id), listSlots(clinic.id)]);
  // Proof first, in code, before the item choice (INTEGRATION 4). A failed proof is a regular price quote.
  const proof = await checkOfferProof({
    clinicId: clinic.id,
    procedureId: request.procedureId,
    offers: events,
    today,
    raw: turn.metadata.offerProof,
  });
  const decision = decideQuote({
    clinicId: clinic.id,
    operationMode: clinic.operationMode,
    languages: localesOf(clinic),
    request,
    menu,
    offers: events,
    slots,
    today,
    quoteId: newId("qt"),
    ...(proof.verified ? { verifiedOfferId: proof.offerId } : {}),
  });
  if (!decision.ok) return { state: "rejected", reason: decision.reason };

  const result = PIBU_SCHEMAS["pibu/quote@1"].parse(decision.quote);
  const proofNote = proof.verified ? `, offer ${proof.offerId} verified` : proof.reason === "no_proof" ? "" : `, proof not applied (${proof.reason})`;
  return {
    state: "completed",
    artifact: dataArtifact(`art_${result.quoteId}`, "quote", result),
    quote: result,
    summary: `quote ${result.quoteId}: ${result.amount.value}${result.amount.unit} ${result.priceKrw} KRW (${decision.basis}${proofNote})`,
  };
}

async function availability(turn: Turn, query: AvailabilityQueryV1): Promise<Outcome> {
  const { clinic } = turn;
  const result = PIBU_SCHEMAS["pibu/availability@1"].parse(
    buildAvailability({ clinicId: clinic.id, operationMode: clinic.operationMode, slots: await listSlots(clinic.id), query }),
  );
  return {
    state: "completed",
    artifact: dataArtifact(`art_availability_${turn.ctx.taskId}`, "availability", result),
    summary: `availability ${query.procedureId} ${query.from}..${query.to}: ${result.slots.length} slots`,
  };
}

/** Labels of the fields the one P0 input request asks for (03 `pibu/input-request@1` example). */
const INPUT_FIELDS: Record<string, InputRequestV1["fields"][number]> = {
  passportName: {
    key: "passportName",
    label: { en: "Name as on passport", ja: "パスポート記載の氏名", ko: "여권상 이름", "zh-CN": "护照上的姓名" },
    sensitive: true,
  },
  lastRejuranDate: {
    key: "lastRejuranDate",
    label: { en: "Date of your last Rejuran", ja: "前回のリジュラン施術日", ko: "마지막 리쥬란 시술일", "zh-CN": "上次丽珠兰治疗日期" },
    sensitive: false,
  },
};

/** P0 asks for more only when the guest name is blank or there is no safety info (BUILD-LOG 22). */
function missingFields(request: BookingRequestV1, procedureId: string): string[] {
  if (request.guest.displayName.trim() !== "" && request.safetyInfo !== undefined) return [];
  return procedureId === "rejuran_healer" ? ["passportName", "lastRejuranDate"] : ["passportName"];
}

function inputRequired(record: ClinicBookingRecord, keys: string[]): Outcome {
  return {
    state: "input_required",
    request: PIBU_SCHEMAS["pibu/input-request@1"].parse({
      schema: "pibu/input-request@1",
      fields: keys.map((key) => INPUT_FIELDS[key]),
    }),
    text: `The clinic needs ${keys.join(", ")} to take booking ${record.id}`,
    summary: `booking ${record.id} waits for ${keys.join(", ")}`,
  };
}

/** A complete booking request: confirmed at once for an autoConfirm clinic, otherwise waiting for the clinic. */
async function proceed(turn: Turn, record: ClinicBookingRecord): Promise<Outcome> {
  const policy = await getSlotPolicy(turn.clinic.id);
  if (policy?.autoConfirm) {
    const booking = await markConfirmed(record, "auto");
    await reportBooking(booking);
    return {
      state: "completed",
      artifact: dataArtifact(`art_${booking.bookingId}`, "booking", booking),
      text: `Booking ${booking.bookingId} confirmed`,
      summary: `booking ${booking.bookingId} confirmed automatically`,
    };
  }
  const who = turn.clinic.operationMode === "proxy" ? "Pibu is checking with the clinic" : "The clinic is checking";
  return {
    state: "working",
    text: `${who}: booking ${record.id} for ${record.request.slot}`,
    summary: `booking ${record.id} pending_clinic`,
  };
}

async function book(turn: Turn, request: BookingRequestV1): Promise<Outcome> {
  const { clinic, ctx } = turn;
  if (request.clinicId !== clinic.id) return { state: "rejected", reason: "wrong_clinic" };
  const referral = await checkReferral(turn.metadata.referralToken, clinic.id, "book");
  if (!referral.ok) return { state: "rejected", reason: referral.reason };

  const issued = await findIssuedQuote(clinic.id, request.quoteId);
  if (!issued) return { state: "rejected", reason: "quote_not_found" };

  const at = Date.parse(request.slot);
  const slot = (await listSlots(clinic.id)).find(
    (s) => Date.parse(s.start) === at && !s.held && s.procedureIds.includes(issued.procedureId),
  );
  if (!slot) return { state: "rejected", reason: "slot_unavailable" };

  const now = clock.nowIso();
  const missing = missingFields(request, issued.procedureId);
  const record: ClinicBookingRecord = {
    id: newId("bkg"),
    clinicId: clinic.id,
    a2aTaskId: ctx.taskId,
    request,
    status: "pending_clinic",
    referralJti: referral.claims.jti,
    customerAgentId: turn.caller,
    referralToken: referral.token,
    priceKrw: issued.priceKrw,
    procedureId: issued.procedureId,
    ...(missing.length > 0 ? { inputRequested: missing } : {}),
    createdAt: now,
    updatedAt: now,
  };
  await putBooking(record);
  await setSlotHeld(clinic.id, slot.start, true);
  return missing.length > 0 ? inputRequired(record, missing) : proceed(turn, record);
}

/** The answer to the input request of a clinic.book task (03 routing rule 3). */
async function bookInput(turn: Turn, answer: InputResponseV1): Promise<Outcome> {
  const record = await findBookingByTask(turn.clinic.id, turn.ctx.taskId);
  if (!record || record.status !== "pending_clinic" || (record.inputRequested?.length ?? 0) === 0) {
    return { state: "failed", reason: "no booking on this task is waiting for input" };
  }
  const values = { ...record.inputValues, ...answer.values };
  const remaining = (record.inputRequested ?? []).filter((key) => (values[key] ?? "").trim() === "");
  const updated: ClinicBookingRecord = { ...record, inputValues: values, updatedAt: clock.nowIso() };
  if (remaining.length > 0) {
    await putBooking({ ...updated, inputRequested: remaining });
    return inputRequired(updated, remaining);
  }
  delete updated.inputRequested;
  await putBooking(updated);
  return proceed(turn, updated);
}

async function cancel(turn: Turn, request: CancelRequestV1): Promise<Outcome> {
  const result = await cancelBooking({
    clinicId: turn.clinic.id,
    customerAgentId: turn.caller,
    bookingId: request.bookingId,
    reason: request.reason,
  });
  if (!result.ok) return { state: "rejected", reason: result.reason };
  return {
    state: "completed",
    artifact: dataArtifact(`art_${result.booking.bookingId}_canceled`, "booking", result.booking),
    summary: `booking ${result.booking.bookingId} canceled`,
  };
}

async function run(turn: Turn): Promise<Outcome> {
  const { ctx } = turn;
  const prior = ctx.task?.status ? { state: taskStateToJSON(ctx.task.status.state) } : undefined;
  const parsed = parsePibuData(turn.metadata.skillId, firstDataValue(ctx.userMessage), prior);
  if (!parsed.ok) return { state: "failed", reason: parsed.error.message };

  if (parsed.kind === "input_response") {
    return parsed.skillId === "clinic.book"
      ? bookInput(turn, parsed.data)
      : { state: "failed", reason: `${parsed.skillId} does not ask for input` };
  }
  switch (parsed.skillId) {
    case "clinic.offers":
      return offers(turn, parsed.data);
    case "clinic.quote":
      return quote(turn, parsed.data);
    case "clinic.availability":
      return availability(turn, parsed.data);
    case "clinic.book":
      return book(turn, parsed.data);
    case "clinic.cancel":
      return cancel(turn, parsed.data);
    default:
      return { state: "failed", reason: `skill ${parsed.skillId} is not a clinic skill` };
  }
}

function statusMessage(taskId: string, contextId: string, outcome: Outcome): Message | undefined {
  switch (outcome.state) {
    case "completed":
      return outcome.text === undefined ? undefined : agentTextMessage(taskId, contextId, outcome.text);
    case "working":
      return agentTextMessage(taskId, contextId, outcome.text);
    case "input_required":
      return agentDataMessage(taskId, contextId, outcome.request, outcome.text);
    case "rejected":
    case "failed":
      return agentTextMessage(taskId, contextId, outcome.reason);
  }
}

const summaryOf = (outcome: Outcome): string =>
  outcome.state === "rejected" ? `rejected: ${outcome.reason}` : outcome.state === "failed" ? `failed: ${outcome.reason}` : outcome.summary;

export const clinicExecutor = (clinic: ClinicRegistryEntry): AgentExecutor => ({
  async execute(ctx, bus) {
    const message = ctx.userMessage;
    // A follow-up turn carries the original skillId (03 routing rule 3); the first message of the task names it.
    const metadata = { ...(ctx.task?.history[0]?.metadata ?? {}), ...(message.metadata ?? {}) } as Record<string, unknown>;
    const turn: Turn = { clinic, ctx, caller: ctx.context.user?.userName ?? "", metadata };

    let outcome: Outcome;
    try {
      outcome = await run(turn);
    } catch (error) {
      outcome = { state: "failed", reason: error instanceof Error ? error.message : String(error) };
    }

    const task: Task = {
      id: ctx.taskId,
      contextId: ctx.contextId,
      status: {
        state: SDK_STATE[outcome.state],
        message: statusMessage(ctx.taskId, ctx.contextId, outcome),
        timestamp: clock.nowIso(),
      },
      artifacts: outcome.state === "completed" ? [outcome.artifact] : [],
      history: ctx.task ? [...ctx.task.history] : [message],
      metadata: ctx.task?.metadata,
    };
    await putClinicTask({
      id: clinicTaskId(clinic.id, ctx.taskId),
      clinicId: clinic.id,
      a2aTaskId: ctx.taskId,
      skillId: String(metadata.skillId ?? "unknown"),
      state: taskStateToJSON(task.status!.state),
      summary: summaryOf(outcome),
      at: clock.nowIso(),
      ...(outcome.state === "completed" && outcome.quote ? { quote: outcome.quote } : {}),
    });
    // The first event must be the task (09 "SDK 함정" 3); it is also the last one of this turn.
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
