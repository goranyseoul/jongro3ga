// Rejecting a pending booking. The cross-track contract (lib/agents/clinic/booking.ts) only has
// confirmBooking, so this prefers a `rejectBooking(clinicId, bookingId, by, reason)` export when the
// clinic track adds one (requested in the OPS report), and otherwise does the minimum itself: finish the
// clinic.book task as REJECTED through the A2A core's task completer and mark the booking canceled.
import * as clinicBooking from "../../../../lib/agents/clinic/booking";
import { taskCompleter } from "../../../../lib/a2a/tasks";
import type { ClinicBooking } from "../../../../lib/domain/clinic";
import type { Store } from "../../../../lib/store/types";
import { CLINIC_COLLECTIONS } from "./bookings";

type By = "clinic_staff" | "pibu_operator";
type RejectFn = (clinicId: string, bookingId: string, by: By, reason: string) => Promise<unknown>;

export interface RejectResult {
  bookingId: string;
  status: "canceled";
  rejectedBy: By;
  via: "clinic_module" | "task_completer";
}

export async function rejectPendingBooking(store: Store, booking: ClinicBooking, by: By, reason: string): Promise<RejectResult> {
  // `in` first: reading a missing export from a module namespace is undefined in ESM but throws in test mocks.
  const fromClinic = "rejectBooking" in clinicBooking ? (clinicBooking as unknown as Record<string, unknown>).rejectBooking : undefined;
  if (typeof fromClinic === "function") {
    await (fromClinic as RejectFn)(booking.clinicId, booking.id, by, reason);
    return { bookingId: booking.id, status: "canceled", rejectedBy: by, via: "clinic_module" };
  }
  await taskCompleter.complete({ role: "clinic", agentId: booking.clinicId }, booking.a2aTaskId, { state: "TASK_STATE_REJECTED", text: reason });
  await store.put<ClinicBooking>("clinic", CLINIC_COLLECTIONS.bookings, { ...booking, status: "canceled" });
  return { bookingId: booking.id, status: "canceled", rejectedBy: by, via: "task_completer" };
}
