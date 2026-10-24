import { getProfile, listBookings, type ClinicBookingRecord } from "./store";

// The operator's proxy queue (/ops/proxy-queue, 02 "대행 응답 큐"): bookings at proxy operated clinics that wait
// for the operator to check with the clinic and confirm (confirmProxyBooking) or decline (rejectBooking).
// Price and menu extraction from SMS (09 LLM table, P1) is not here yet.

/** Pending bookings at proxy clinics, oldest first. Bookings still waiting for the customer's input are left out. */
export async function listProxyQueue(): Promise<ClinicBookingRecord[]> {
  const pending = await listBookings({ status: "pending_clinic" });
  const modes = new Map<string, string | undefined>();
  const out: ClinicBookingRecord[] = [];
  for (const booking of pending) {
    if ((booking.inputRequested?.length ?? 0) > 0) continue;
    if (!modes.has(booking.clinicId)) modes.set(booking.clinicId, (await getProfile(booking.clinicId))?.operationMode);
    if (modes.get(booking.clinicId) === "proxy") out.push(booking);
  }
  return out.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}
