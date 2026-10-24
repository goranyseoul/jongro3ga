import { EXT } from "../../a2a/cards";
import { A2AClientError, getTask, sendMessage, type AgentRef } from "../../a2a/client";
import { BookingV1Schema, InputRequestV1Schema, type BookingV1 } from "../../a2a/schemas";
import { firstDataPart, taskArtifactData, type WireTask } from "../../a2a/wire";
import { clock } from "../../clock";
import type { IsoDateTime, OutcomeDraft } from "../../domain";
import { answerFromProfile, buildBookingRequest, CONSENT_EXT } from "./consent";
import { addRecord } from "./records";
import { seoulDate } from "./schedule";
import { customerStore, findBooking, newId, outcomeDraftId, type StoredBooking } from "./store";

// 예약 대행 (02 1절, 03 clinic.book, 09 "clinic.book 흐름").
//
//   bookQuote    clinic.book with returnImmediately (the client sets it) -> CustomerBooking "requested"
//   pollBooking  GetTask every 3 seconds for up to 10 minutes until the clinic decides
//                COMPLETED  -> pibu/booking@1 stored, TreatmentRecord (source "booking"), D0/D7/D30 outcome drafts
//                REJECTED, CANCELED, FAILED -> "canceled" with the clinic's reason, the request is back to comparing
//                INPUT_REQUIRED -> fields the ledger lets the agent answer go back as pibu/input-response@1 on the
//                same task; the rest wait in `pendingInput` for the customer (WP7 screen, answerInput)

export interface BookOptions {
  fetchImpl?: typeof fetch;
  /** GetTask interval. Default 3000 (03 "P0: 3초 간격"). */
  pollIntervalMs?: number;
  /** How long to poll. Default 10 minutes (03 "최대 10분"). */
  pollTimeoutMs?: number;
  /** "background" (default) starts pollBooking without waiting, "await" waits for it, "none" does not poll. */
  poll?: "background" | "await" | "none";
}

const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 10 * 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const statusText = (task: WireTask): string =>
  (task.status.message?.parts ?? [])
    .map((part) => part.text)
    .filter((text): text is string => typeof text === "string")
    .join(" ");

const fetchOpt = (opts: { fetchImpl?: typeof fetch }) => (opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {});

async function agentOf(customerId: string): Promise<AgentRef> {
  const account = await customerStore.account(customerId);
  if (!account) throw new Error(`no customer ${customerId}`);
  return { agentId: account.agentId, role: "customer" };
}

async function saveBooking(booking: StoredBooking, patch: Partial<StoredBooking> = {}): Promise<StoredBooking> {
  const next = { ...booking, ...patch, updatedAt: clock.nowIso() };
  await customerStore.putBooking(next);
  return next;
}

async function setRequestStatus(requestId: string, status: "booking" | "booked" | "comparing"): Promise<void> {
  const request = await customerStore.request(requestId);
  if (request) await customerStore.putRequest({ ...request, status, updatedAt: clock.nowIso() });
}

/** Sends the customer's request to book `quoteId` at `slot`. Throws when the quote, consent or clinic is not there. */
export async function bookQuote(requestId: string, quoteId: string, slot: IsoDateTime, opts: BookOptions = {}): Promise<StoredBooking> {
  const request = await customerStore.request(requestId);
  if (!request) throw new Error(`no request ${requestId}`);
  const stored = await customerStore.quote(quoteId);
  if (!stored || stored.requestId !== requestId) throw new Error(`quote ${quoteId} is not a quote of ${requestId}`);
  const candidate = request.shortlist?.candidates.find((c) => c.clinicId === stored.quote.clinicId);
  if (!candidate) throw new Error(`${stored.quote.clinicId} is not on the shortlist of ${requestId}`);
  const [profile, consents, from] = await Promise.all([
    customerStore.profile(request.customerId),
    customerStore.consents(request.customerId),
    agentOf(request.customerId),
  ]);
  if (!profile) throw new Error(`no profile ${request.customerId}`);

  const built = buildBookingRequest({ profile, consents, requestId, quoteId, clinicId: candidate.clinicId, slot });
  if (!built.ok) throw new Error(built.reason);

  const task = await sendMessage({
    from,
    toCardUrl: candidate.agentCardUrl,
    skillId: "clinic.book",
    data: built.request,
    text: `Booking request for ${slot}`,
    contextId: requestId,
    metadata: { referralToken: candidate.referralToken, consentRef: built.consentRef },
    extensions: [EXT.referral, CONSENT_EXT],
    ...fetchOpt(opts),
  });

  const now = clock.nowIso();
  let booking: StoredBooking = {
    id: newId("cbk"),
    requestId,
    clinicId: candidate.clinicId,
    clinicTaskId: task.id,
    status: "requested",
    customerId: request.customerId,
    quoteId,
    procedureId: stored.quote.procedureId,
    slot,
    clinicCardUrl: candidate.agentCardUrl,
    createdAt: now,
    updatedAt: now,
  };
  await customerStore.putBooking(booking);
  await setRequestStatus(requestId, "booking");
  booking = (await applyTask(booking, task, from, opts)).booking;

  const mode = opts.poll ?? "background";
  if (mode === "await" && !isSettled(booking)) return pollBooking(booking.id, opts);
  if (mode === "background" && !isSettled(booking)) void pollBooking(booking.id, opts).catch(() => undefined);
  return booking;
}

/** Nothing more to poll for: decided, or waiting for the customer's own answer. */
const isSettled = (booking: StoredBooking): boolean => booking.status !== "requested" || (booking.pendingInput?.length ?? 0) > 0;

// ---- one task state ----

interface Applied {
  booking: StoredBooking;
  /** True when polling should stop. */
  done: boolean;
}

/**
 * Applies the clinic task's current state to the booking. `answered` lists the keys the agent already sent on
 * this task, so a clinic asking the same field twice ends in pendingInput instead of a loop.
 */
async function applyTask(booking: StoredBooking, task: WireTask, from: AgentRef, opts: BookOptions, answered: ReadonlySet<string> = new Set()): Promise<Applied> {
  switch (task.status.state) {
    case "TASK_STATE_COMPLETED":
      return { booking: await confirmed(booking, task), done: true };
    case "TASK_STATE_REJECTED":
    case "TASK_STATE_CANCELED":
    case "TASK_STATE_FAILED": {
      const ended = await saveBooking(booking, { status: "canceled", endReason: statusText(task) || task.status.state });
      await setRequestStatus(booking.requestId, "comparing");
      return { booking: ended, done: true };
    }
    case "TASK_STATE_INPUT_REQUIRED":
      return inputRequired(booking, task, from, opts, answered);
    default: {
      // SUBMITTED, WORKING: the clinic is checking.
      if (booking.pendingInput) {
        const next = { ...booking };
        delete next.pendingInput;
        return { booking: await saveBooking(next), done: false };
      }
      return { booking, done: false };
    }
  }
}

async function confirmed(booking: StoredBooking, task: WireTask): Promise<StoredBooking> {
  const parsed = BookingV1Schema.safeParse(taskArtifactData(task));
  if (!parsed.success) return saveBooking(booking, { status: "canceled", endReason: "invalid_booking_artifact" });
  const wire: BookingV1 = parsed.data;
  const next: StoredBooking = { ...booking, booking: wire, status: wire.status };
  delete next.pendingInput;

  if (wire.status === "confirmed" || wire.status === "completed") {
    if (!booking.recordId) {
      const quote = await customerStore.quote(booking.quoteId);
      const record = await addRecord(
        booking.customerId,
        {
          procedureId: booking.procedureId,
          date: seoulDate(wire.slot),
          ...(quote ? { amount: quote.quote.amount } : {}),
          priceKrw: wire.priceKrw,
          clinicId: wire.clinicId,
          source: "booking",
        },
        `rec_${wire.bookingId}`,
      );
      next.recordId = record.id;
    }
    await ensureOutcomeDrafts(wire);
    await setRequestStatus(booking.requestId, "booked");
  }
  return saveBooking(next);
}

/** D0 at the slot, D7 and D30 after it (06 OutcomeDraft), created once per booking. */
async function ensureOutcomeDrafts(wire: BookingV1): Promise<void> {
  const at = Date.parse(wire.slot);
  const due = (days: number) => new Date(at + days * DAY_MS).toISOString();
  const plan: Array<[OutcomeDraft["checkpoint"], number]> = [
    ["D0", 0],
    ["D7", 7],
    ["D30", 30],
  ];
  for (const [checkpoint, days] of plan) {
    const id = outcomeDraftId(wire.bookingId, checkpoint);
    if (await customerStore.outcomeDraft(id)) continue;
    await customerStore.putOutcomeDraft({ id, bookingId: wire.bookingId, checkpoint, dueAt: days === 0 ? wire.slot : toKst(due(days)) });
  }
}

const toKst = (utcIso: string): IsoDateTime => `${new Date(Date.parse(utcIso) + 9 * 60 * 60 * 1000).toISOString().slice(0, 19)}+09:00`;

async function inputRequired(booking: StoredBooking, task: WireTask, from: AgentRef, opts: BookOptions, answered: ReadonlySet<string>): Promise<Applied> {
  const message = task.status.message;
  const parsed = InputRequestV1Schema.safeParse(message ? firstDataPart(message) : undefined);
  // A malformed input request: keep polling, the clinic may still move the task on.
  if (!parsed.success) return { booking, done: false };
  const fields = parsed.data.fields;

  const [profile, consents] = await Promise.all([customerStore.profile(booking.customerId), customerStore.consents(booking.customerId)]);
  const values: Record<string, string> = {};
  for (const field of fields) {
    if (answered.has(field.key) || !profile) continue;
    const value = answerFromProfile(field.key, profile, consents);
    if (value !== undefined) values[field.key] = value;
  }
  if (Object.keys(values).length === 0) {
    // Nothing the ledger lets the agent say: the customer answers on the booking screen.
    return { booking: await saveBooking(booking, { pendingInput: fields }), done: true };
  }
  const next = await sendInput(booking, values, from, opts);
  return applyTask(booking, next, from, opts, new Set([...answered, ...Object.keys(values)]));
}

async function sendInput(booking: StoredBooking, values: Record<string, string>, from: AgentRef, opts: { fetchImpl?: typeof fetch }): Promise<WireTask> {
  return sendMessage({
    from,
    toCardUrl: booking.clinicCardUrl,
    skillId: "clinic.book",
    data: { schema: "pibu/input-response@1", values },
    text: `Answering ${Object.keys(values).join(", ")}`,
    contextId: booking.requestId,
    taskId: booking.clinicTaskId,
    ...fetchOpt(opts),
  });
}

/**
 * The customer's answers to the fields in `pendingInput` (booking screen). Sends them on the same task and keeps
 * polling as `opts.poll` says (default "background").
 */
export async function answerInput(bookingId: string, values: Record<string, string>, opts: BookOptions = {}): Promise<StoredBooking> {
  const booking = await findBooking(bookingId);
  if (!booking) throw new Error(`no booking ${bookingId}`);
  const from = await agentOf(booking.customerId);
  const task = await sendInput(booking, values, from, opts);
  const cleared = { ...booking };
  delete cleared.pendingInput;
  const applied = await applyTask(await saveBooking(cleared), task, from, opts, new Set(Object.keys(values)));
  const mode = opts.poll ?? "background";
  if (mode === "await" && !isSettled(applied.booking)) return pollBooking(applied.booking.id, opts);
  if (mode === "background" && !isSettled(applied.booking)) void pollBooking(applied.booking.id, opts).catch(() => undefined);
  return applied.booking;
}

// ---- polling ----

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One poll loop per booking per process: a second call joins the running one. */
const running = ((globalThis as { __pibuCustomerPolls?: Map<string, Promise<StoredBooking>> }).__pibuCustomerPolls ??= new Map());

/**
 * Polls the clinic task with GetTask until it is decided, waits for the customer, or `pollTimeoutMs` passes.
 * Resolves with the booking as stored at the end. Safe to call again to resume (e.g. after a restart of the poll).
 */
export function pollBooking(bookingId: string, opts: BookOptions = {}): Promise<StoredBooking> {
  const current = running.get(bookingId);
  if (current) return current;
  const loop = pollLoop(bookingId, opts).finally(() => running.delete(bookingId));
  running.set(bookingId, loop);
  return loop;
}

async function pollLoop(bookingId: string, opts: BookOptions): Promise<StoredBooking> {
  let booking = await findBooking(bookingId);
  if (!booking) throw new Error(`no booking ${bookingId}`);
  const from = await agentOf(booking.customerId);
  const interval = opts.pollIntervalMs ?? POLL_INTERVAL_MS;
  const deadline = performance.now() + (opts.pollTimeoutMs ?? POLL_TIMEOUT_MS);

  while (!isSettled(booking)) {
    try {
      const task = await getTask({
        from,
        toCardUrl: booking.clinicCardUrl,
        taskId: booking.clinicTaskId,
        contextId: booking.requestId,
        skillId: "clinic.book",
        ...fetchOpt(opts),
      });
      const applied = await applyTask(booking, task, from, opts);
      booking = applied.booking;
      if (applied.done) break;
    } catch (error) {
      // The clinic forgot the task (its in-memory task store restarted): nothing left to wait for.
      if (error instanceof A2AClientError && error.kind === "rpc" && error.code === -32001) {
        booking = await saveBooking(booking, { status: "canceled", endReason: "task_not_found" });
        break;
      }
      // Timeouts and network errors: try again on the next tick.
    }
    if (performance.now() + interval > deadline) break;
    await sleep(interval);
  }
  return (await customerStore.booking(booking.id)) ?? booking;
}

// ---- cancel and reads ----

/** clinic.cancel for a requested or confirmed booking. */
export async function cancelBooking(bookingId: string, reason: string, opts: { fetchImpl?: typeof fetch } = {}): Promise<StoredBooking> {
  const booking = await findBooking(bookingId);
  if (!booking?.booking) throw new Error(`booking ${bookingId} has no clinic booking id yet`);
  const from = await agentOf(booking.customerId);
  const task = await sendMessage({
    from,
    toCardUrl: booking.clinicCardUrl,
    skillId: "clinic.cancel",
    data: { schema: "pibu/cancel-request@1", bookingId: booking.booking.bookingId, reason },
    contextId: booking.requestId,
    ...fetchOpt(opts),
  });
  if (task.status.state !== "TASK_STATE_COMPLETED") throw new Error(statusText(task) || task.status.state);
  const wire = BookingV1Schema.parse(taskArtifactData(task));
  return saveBooking(booking, { booking: wire, status: wire.status });
}

/** The customer's bookings, newest first. */
export async function listBookings(customerId: string): Promise<StoredBooking[]> {
  return (await customerStore.bookings({ customerId })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** A booking by the customer booking id (`cbk_`) or the clinic's booking id (`bkg_`). */
export const getBooking = findBooking;
