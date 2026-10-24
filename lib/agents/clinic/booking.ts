import { TaskState, type Task } from "@a2a-js/sdk";
import { agentUrls } from "../../a2a/cards";
import { sendMessage } from "../../a2a/client";
import { PIBU_SCHEMAS, type BookingV1 } from "../../a2a/schemas";
import { callContextFor, taskStoreFor } from "../../a2a/server";
import { clock } from "../../clock";
import type { I18nText, Locale } from "../../domain";
import { agentTextMessage, dataArtifact } from "./sdk";
import {
  clinicTaskId,
  getBooking,
  getProfile,
  putBooking,
  putClinicTask,
  setSlotHeld,
  type ClinicBookingRecord,
} from "./store";

// Booking confirmation, rejection and cancellation (02 "예약 확정", 09 "AgentExecutor 공통 흐름" clinic.book).
// A clinic.book task waits in TASK_STATE_WORKING until the operator (proxy clinic, /ops/proxy-queue) or the
// clinic (direct clinic, /clinic/inbox) decides. The decision is written straight into the SDK task store as the
// customer agent that created the task, so the customer's GetTask poll sees it (BUILD-LOG 19 (4)), and a
// confirmation is reported to the platform with platform.report_booking.

export interface ConfirmOptions {
  /** fetch for the platform.report_booking call. Tests pass lib/a2a/__fixtures__/route-fetch.ts. */
  fetchImpl?: typeof fetch;
}

/** How long a confirmation waits for the platform. The booking is confirmed either way. */
const REPORT_TIMEOUT_MS = 5_000;

const INSTRUCTIONS: Partial<Record<Locale, string>> = {
  ja: "当日はノーメイクでお越しください。予約時刻の10分前にご来院ください。",
  en: "Please come without makeup and arrive 10 minutes before your appointment.",
  ko: "당일에는 화장을 하지 않고 오시고, 예약 시간 10분 전에 도착해 주세요.",
};

/** Visit instructions in the clinic's languages among ja, en and ko (template sentences). */
export function instructionsFor(languages: readonly Locale[]): I18nText | undefined {
  const out: I18nText = {};
  for (const locale of languages) {
    const text = INSTRUCTIONS[locale];
    if (text) out[locale] = text;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The wire pibu/booking@1 for a stored booking, validated. */
export function bookingV1Of(record: ClinicBookingRecord, languages: readonly Locale[]): BookingV1 {
  const instructions = record.status === "confirmed" ? instructionsFor(languages) : undefined;
  return PIBU_SCHEMAS["pibu/booking@1"].parse({
    schema: "pibu/booking@1",
    bookingId: record.id,
    requestId: record.request.requestId,
    quoteId: record.request.quoteId,
    clinicId: record.clinicId,
    customerAgentId: record.customerAgentId,
    slot: record.request.slot,
    status: record.status,
    ...(record.confirmedBy === undefined ? {} : { confirmedBy: record.confirmedBy }),
    priceKrw: record.priceKrw,
    referralToken: record.referralToken,
    ...(instructions === undefined ? {} : { instructions }),
  });
}

async function clinicLanguages(clinicId: string): Promise<Locale[]> {
  return (await getProfile(clinicId))?.languages.map((l) => l.locale) ?? [];
}

async function journal(record: ClinicBookingRecord, state: string, summary: string): Promise<void> {
  await putClinicTask({
    id: clinicTaskId(record.clinicId, record.a2aTaskId),
    clinicId: record.clinicId,
    a2aTaskId: record.a2aTaskId,
    skillId: "clinic.book",
    state,
    summary,
    at: clock.nowIso(),
  });
}

/**
 * Rewrites the clinic.book task in the SDK task store as its customer. Does nothing when the task is gone
 * (process restart: the in-memory task store does not persist) or already finished.
 */
async function writeTask(record: ClinicBookingRecord, update: (task: Task) => void): Promise<void> {
  const profile = await getProfile(record.clinicId);
  if (!profile) return;
  const store = taskStoreFor(`clinic:${profile.slug}`);
  const asCustomer = callContextFor(record.customerAgentId, "customer");
  const task = await store.load(record.a2aTaskId, asCustomer);
  if (!task) return;
  const state = task.status?.state;
  if (
    state === TaskState.TASK_STATE_COMPLETED ||
    state === TaskState.TASK_STATE_REJECTED ||
    state === TaskState.TASK_STATE_CANCELED ||
    state === TaskState.TASK_STATE_FAILED
  ) {
    return;
  }
  update(task);
  await store.save(task, asCustomer);
}

/** Calls platform.report_booking. The platform's answer does not matter and a failure is swallowed (10 T05). */
export async function reportBooking(booking: BookingV1, options: ConfirmOptions = {}): Promise<void> {
  try {
    await sendMessage({
      from: { agentId: booking.clinicId, role: "clinic" },
      toCardUrl: agentUrls.platform().card,
      skillId: "platform.report_booking",
      data: booking,
      text: `Booking ${booking.bookingId} confirmed for ${booking.slot}`,
      contextId: booking.requestId,
      timeoutMs: REPORT_TIMEOUT_MS,
      ...(options.fetchImpl === undefined ? {} : { fetchImpl: options.fetchImpl }),
    });
  } catch {
    // The client already logged what the platform never saw (timeouts, network); nothing else to do here.
  }
}

/**
 * Marks a pending booking confirmed and stores it. Returns the pibu/booking@1. Used by the two confirm
 * functions below and by the executor for an autoConfirm clinic.
 */
export async function markConfirmed(
  record: ClinicBookingRecord,
  confirmedBy: NonNullable<ClinicBookingRecord["confirmedBy"]>,
): Promise<BookingV1> {
  const confirmed: ClinicBookingRecord = { ...record, status: "confirmed", confirmedBy, updatedAt: clock.nowIso() };
  await putBooking(confirmed);
  await journal(confirmed, "TASK_STATE_COMPLETED", `booking ${confirmed.id} confirmed by ${confirmedBy}`);
  return bookingV1Of(confirmed, await clinicLanguages(confirmed.clinicId));
}

async function pendingBooking(bookingId: string, mode: "proxy" | "clinic"): Promise<ClinicBookingRecord> {
  const record = await getBooking(bookingId);
  if (!record) throw new Error(`no booking ${bookingId}`);
  if (record.status !== "pending_clinic") throw new Error(`booking ${bookingId} is ${record.status}, not pending_clinic`);
  if ((record.inputRequested?.length ?? 0) > 0) throw new Error(`booking ${bookingId} still waits for the customer's input`);
  const profile = await getProfile(record.clinicId);
  if (profile && profile.operationMode !== mode) {
    const other = mode === "proxy" ? "confirmClinicBooking" : "confirmProxyBooking";
    throw new Error(`booking ${bookingId} is at a ${profile.operationMode} clinic: use ${other}`);
  }
  return record;
}

async function confirm(record: ClinicBookingRecord, by: "pibu_operator" | "clinic_staff", options: ConfirmOptions) {
  const booking = await markConfirmed(record, by);
  await writeTask(record, (task) => {
    task.artifacts = [dataArtifact(`art_${booking.bookingId}`, "booking", booking)];
    task.status = {
      state: TaskState.TASK_STATE_COMPLETED,
      message: agentTextMessage(task.id, task.contextId, `Booking ${booking.bookingId} confirmed`),
      timestamp: clock.nowIso(),
    };
  });
  await reportBooking(booking, options);
  return booking;
}

/** The operator confirms a proxy clinic's booking from the proxy queue (confirmedBy "pibu_operator"). */
export async function confirmProxyBooking(bookingId: string, options: ConfirmOptions = {}): Promise<BookingV1> {
  return confirm(await pendingBooking(bookingId, "proxy"), "pibu_operator", options);
}

/** A direct clinic confirms from its inbox (confirmedBy "clinic_staff"). */
export async function confirmClinicBooking(bookingId: string, options: ConfirmOptions = {}): Promise<BookingV1> {
  return confirm(await pendingBooking(bookingId, "clinic"), "clinic_staff", options);
}

/**
 * The clinic (or the operator for it) declines a pending booking: the booking is canceled, the slot freed and
 * the customer's task ends TASK_STATE_REJECTED with `booking_rejected: <reason>`.
 */
export async function rejectBooking(bookingId: string, reason: string): Promise<BookingV1> {
  const record = await getBooking(bookingId);
  if (!record) throw new Error(`no booking ${bookingId}`);
  if (record.status !== "pending_clinic") throw new Error(`booking ${bookingId} is ${record.status}, not pending_clinic`);
  const canceled: ClinicBookingRecord = { ...record, status: "canceled", updatedAt: clock.nowIso() };
  await putBooking(canceled);
  await setSlotHeld(record.clinicId, record.request.slot, false);
  await journal(canceled, "TASK_STATE_REJECTED", `booking ${record.id} rejected: ${reason}`);
  await writeTask(record, (task) => {
    task.status = {
      state: TaskState.TASK_STATE_REJECTED,
      message: agentTextMessage(task.id, task.contextId, `booking_rejected: ${reason}`),
      timestamp: clock.nowIso(),
    };
  });
  return bookingV1Of(canceled, await clinicLanguages(record.clinicId));
}

export type CancelResult = { ok: true; booking: BookingV1 } | { ok: false; reason: "booking_not_found" | "booking_not_cancelable" };

/**
 * clinic.cancel from the customer agent that booked. Canceling twice answers the canceled booking again.
 * A booking task still waiting (WORKING or INPUT_REQUIRED) ends TASK_STATE_CANCELED.
 */
export async function cancelBooking(input: {
  clinicId: string;
  customerAgentId: string;
  bookingId: string;
  reason: string;
}): Promise<CancelResult> {
  const record = await getBooking(input.bookingId);
  if (!record || record.clinicId !== input.clinicId || record.customerAgentId !== input.customerAgentId) {
    return { ok: false, reason: "booking_not_found" };
  }
  const languages = await clinicLanguages(record.clinicId);
  if (record.status === "canceled") return { ok: true, booking: bookingV1Of(record, languages) };
  if (record.status !== "pending_clinic" && record.status !== "confirmed") return { ok: false, reason: "booking_not_cancelable" };

  const canceled: ClinicBookingRecord = { ...record, status: "canceled", updatedAt: clock.nowIso() };
  await putBooking(canceled);
  await setSlotHeld(record.clinicId, record.request.slot, false);
  await journal(canceled, "TASK_STATE_CANCELED", `booking ${record.id} canceled by the customer: ${input.reason}`);
  await writeTask(record, (task) => {
    task.status = {
      state: TaskState.TASK_STATE_CANCELED,
      message: agentTextMessage(task.id, task.contextId, `Booking ${record.id} canceled by the customer`),
      timestamp: clock.nowIso(),
    };
  });
  return { ok: true, booking: bookingV1Of(canceled, languages) };
}
