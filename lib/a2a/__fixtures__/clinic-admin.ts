import { confirmClinicBooking, confirmProxyBooking, rejectBooking } from "../../agents/clinic/booking";
import { findBookingByTask } from "../../agents/clinic/store";

// Test only: what the clinic console and the operator's proxy queue do to a pending booking (WP3,
// lib/agents/clinic/booking.ts). The customer module's tests may not import the clinic module
// (scripts/check-boundaries.mjs), so they go through this file, which lib/a2a/** may import.

export { confirmClinicBooking, confirmProxyBooking, rejectBooking };

/** The clinic's booking id (`bkg_`) behind the clinic.book task the customer agent holds. */
export async function clinicBookingIdForTask(clinicId: string, taskId: string): Promise<string> {
  const record = await findBookingByTask(clinicId, taskId);
  if (!record) throw new Error(`no clinic booking for task ${taskId} at ${clinicId}`);
  return record.id;
}
