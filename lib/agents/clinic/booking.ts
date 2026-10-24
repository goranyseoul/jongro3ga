// Booking decisions on a pending clinic.book task. OWNER: track CLINIC.
// confirmBooking is the entry point for the clinic console (/clinic/inbox) and the ops proxy queue
// (/ops/proxy-queue). It completes the waiting A2A task, reports to the platform and notifies the customer.
import { sendMessage, cardUrl } from "../../a2a/client";
import { taskCompleter } from "../../a2a/tasks";
import type { AgentRef, SkillResult } from "../../a2a/contract";
import { clock } from "../../clock";
import type { Locale } from "../../domain/common";
import { bookingWire, clinicStore, type AwaitingGuest, type ClinicStore, type StoredBooking } from "./store";

export interface ConfirmResult {
  bookingId: string;
  status: "confirmed" | "canceled";
  confirmedBy: "clinic_staff" | "pibu_operator" | "auto";
}

export class BookingError extends Error {
  constructor(
    message: string,
    readonly code: "not_found" | "wrong_clinic" | "not_pending" | "invalid",
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export function publicBaseUrl(): string {
  return (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

const clinicRef = (clinicId: string): AgentRef => ({ role: "clinic", agentId: clinicId });

async function loadPending(db: ClinicStore, clinicId: string, bookingId: string): Promise<StoredBooking> {
  const booking = await db.booking(bookingId);
  if (!booking) throw new BookingError(`booking ${bookingId} not found`, "not_found");
  if (booking.clinicId !== clinicId) throw new BookingError(`booking ${bookingId} belongs to another clinic`, "wrong_clinic");
  return booking;
}

async function setSlotHeld(db: ClinicStore, clinicId: string, start: string, held: boolean): Promise<void> {
  const slots = await db.slots(clinicId);
  const slot = slots.find((candidate) => Date.parse(candidate.start) === Date.parse(start));
  if (slot && slot.held !== held) await db.putSlot({ ...slot, held });
}

export const holdSlot = (db: ClinicStore, clinicId: string, start: string) => setSlotHeld(db, clinicId, start, true);
export const releaseSlot = (db: ClinicStore, clinicId: string, start: string) => setSlotHeld(db, clinicId, start, false);

const CONFIRMED_TEXT: Record<Locale, (slot: string) => string> = {
  ko: (slot) => `예약이 확정됐어요: ${slot}`,
  ja: (slot) => `ご予約が確定しました: ${slot}`,
  en: (slot) => `Your booking is confirmed: ${slot}`,
  "zh-CN": (slot) => `您的预约已确认: ${slot}`,
};

function slotLabel(iso: string): string {
  // "2026-11-14 11:00 (KST)": readable in every language without locale formatting on the server.
  const kst = new Date(Date.parse(iso) + 9 * 3_600_000).toISOString();
  return `${kst.slice(0, 10)} ${kst.slice(11, 16)} (KST)`;
}

/**
 * After a booking turns confirmed (staff, operator or auto confirm): report it to the platform for attribution
 * (platform.report_booking) and tell the customer agent (customer.notify). Both are best effort: a failure is
 * recorded on the booking and never undoes the confirmation (10-build-plan T05 allows FAILED from the platform).
 */
export async function announceConfirmation(booking: StoredBooking, db: ClinicStore = clinicStore()): Promise<StoredBooking> {
  const base = publicBaseUrl();
  const wire = bookingWire(booking);
  const reports: NonNullable<StoredBooking["reports"]> = { ...booking.reports };

  try {
    const task = await sendMessage({
      from: clinicRef(booking.clinicId),
      toCardUrl: cardUrl(base, { role: "platform", agentId: "platform" }),
      skillId: "platform.report_booking",
      data: wire,
      text: `Booking ${booking.id} confirmed for ${slotLabel(booking.request.slot)}`,
      contextId: booking.request.requestId,
      metadata: { referralToken: booking.referralToken },
    });
    reports.platform = { ok: task.status.state === "TASK_STATE_COMPLETED", state: task.status.state, at: clock.nowIso() };
  } catch (error) {
    reports.platform = { ok: false, error: String((error as Error).message ?? error), at: clock.nowIso() };
  }

  const language = booking.request.guest.language;
  const slot = slotLabel(booking.request.slot);
  try {
    const task = await sendMessage({
      from: clinicRef(booking.clinicId),
      toCardUrl: cardUrl(base, { role: "customer", agentId: booking.customerAgentId }),
      skillId: "customer.notify",
      data: {
        schema: "pibu/notification@1",
        kind: "booking_confirmed",
        bookingId: booking.id,
        text: { [language]: CONFIRMED_TEXT[language](slot), ...(language === "en" ? {} : { en: CONFIRMED_TEXT.en(slot) }) },
      },
      text: CONFIRMED_TEXT[language](slot),
      contextId: booking.request.requestId,
    });
    reports.customer = { ok: task.status.state === "TASK_STATE_COMPLETED", state: task.status.state, at: clock.nowIso() };
  } catch (error) {
    reports.customer = { ok: false, error: String((error as Error).message ?? error), at: clock.nowIso() };
  }

  const next = { ...booking, reports };
  await db.putBooking(next);
  return next;
}

async function syncTask(db: ClinicStore, booking: StoredBooking, state: string, reason?: string): Promise<void> {
  const task = await db.task(booking.a2aTaskId);
  if (task) await db.putTask({ ...task, state, reason, bookingId: booking.id });
}

/**
 * Confirms a pending booking: the waiting clinic.book task becomes TASK_STATE_COMPLETED with a pibu/booking@1
 * artifact (the customer agent sees it through GetTask), then the platform and the customer are told.
 * Confirming an already confirmed booking returns the same result without calling anyone again.
 */
export async function confirmBooking(
  clinicId: string,
  bookingId: string,
  by: ConfirmResult["confirmedBy"],
): Promise<ConfirmResult> {
  const db = clinicStore();
  const booking = await loadPending(db, clinicId, bookingId);
  if (booking.status === "confirmed" || booking.status === "completed") {
    return { bookingId, status: "confirmed", confirmedBy: booking.confirmedBy ?? by };
  }
  if (booking.status !== "pending_clinic") {
    throw new BookingError(`booking ${bookingId} is ${booking.status}, not pending`, "not_pending");
  }

  const confirmed: StoredBooking = {
    ...booking,
    status: "confirmed",
    confirmedBy: by,
    confirmedAt: clock.nowIso(),
    awaitingGuest: undefined,
  };
  const result: SkillResult = {
    state: "TASK_STATE_COMPLETED",
    data: bookingWire(confirmed),
    text: `Booking confirmed for ${slotLabel(confirmed.request.slot)}`,
  };
  // Complete the A2A task first: if the task store refuses, the booking stays pending and the caller sees the error.
  await taskCompleter.complete(clinicRef(clinicId), booking.a2aTaskId, result);
  await holdSlot(db, clinicId, confirmed.request.slot);
  await db.putBooking(confirmed);
  await syncTask(db, confirmed, "TASK_STATE_COMPLETED");
  await announceConfirmation(confirmed, db);
  return { bookingId, status: "confirmed", confirmedBy: by };
}

/** Clinic (or operator) declines: the booking is canceled, the slot freed, the task ends TASK_STATE_REJECTED. */
export async function rejectBooking(clinicId: string, bookingId: string, reason: string): Promise<StoredBooking> {
  const db = clinicStore();
  const booking = await loadPending(db, clinicId, bookingId);
  if (booking.status !== "pending_clinic") {
    throw new BookingError(`booking ${bookingId} is ${booking.status}, not pending`, "not_pending");
  }
  const text = reason.trim() || "The clinic cannot take this booking";
  await taskCompleter.complete(clinicRef(clinicId), booking.a2aTaskId, { state: "TASK_STATE_REJECTED", text });
  const canceled: StoredBooking = { ...booking, status: "canceled", rejectReason: text, awaitingGuest: undefined };
  await releaseSlot(db, clinicId, booking.request.slot);
  await db.putBooking(canceled);
  await syncTask(db, canceled, "TASK_STATE_REJECTED", text);
  return canceled;
}

async function askGuest(clinicId: string, bookingId: string, awaiting: AwaitingGuest, text: string): Promise<StoredBooking> {
  const db = clinicStore();
  const booking = await loadPending(db, clinicId, bookingId);
  if (booking.status !== "pending_clinic") {
    throw new BookingError(`booking ${bookingId} is ${booking.status}, not pending`, "not_pending");
  }
  await taskCompleter.complete(clinicRef(clinicId), booking.a2aTaskId, {
    state: "TASK_STATE_INPUT_REQUIRED",
    text,
    inputRequest: { schema: "pibu/input-request@1", fields: awaiting.fields },
  });
  const next: StoredBooking = { ...booking, awaitingGuest: awaiting };
  await db.putBooking(next);
  await syncTask(db, next, "TASK_STATE_INPUT_REQUIRED");
  return next;
}

export const ACCEPT_PROPOSED_SLOT = "acceptProposedSlot";

/** Offers another time. The task goes to INPUT_REQUIRED; the guest answers acceptProposedSlot = yes or no. */
export function proposeBookingTime(clinicId: string, bookingId: string, slot: string): Promise<StoredBooking> {
  if (Number.isNaN(Date.parse(slot))) throw new BookingError(`not a valid slot: ${slot}`, "invalid");
  const label = slotLabel(slot);
  return askGuest(
    clinicId,
    bookingId,
    {
      kind: "propose",
      proposedSlot: slot,
      at: clock.nowIso(),
      fields: [
        {
          key: ACCEPT_PROPOSED_SLOT,
          label: {
            en: `The clinic proposes ${label}. Accept? (yes or no)`,
            ja: `クリニックから ${label} の提案があります。よろしいですか (yes または no)`,
            ko: `병원이 ${label}을 제안했어요. 수락할까요? (yes 또는 no)`,
            "zh-CN": `诊所建议改为 ${label}。是否接受 (yes 或 no)`,
          },
          sensitive: false,
        },
      ],
    },
    `The requested time is not available. Proposed instead: ${label}`,
  );
}

/** Asks the guest for more information (03 pibu/input-request@1). */
export function requestBookingInfo(clinicId: string, bookingId: string, fields: AwaitingGuest["fields"]): Promise<StoredBooking> {
  if (fields.length === 0) throw new BookingError("at least one field is required", "invalid");
  return askGuest(clinicId, bookingId, { kind: "ask", fields, at: clock.nowIso() }, "The clinic needs more information to confirm");
}
