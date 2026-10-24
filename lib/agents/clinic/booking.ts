// Booking confirmation entry point used by the clinic console and the ops proxy queue. OWNER: track CLINIC.
export interface ConfirmResult {
  bookingId: string;
  status: "confirmed" | "canceled";
  confirmedBy: "clinic_staff" | "pibu_operator" | "auto";
}

export async function confirmBooking(
  _clinicId: string,
  _bookingId: string,
  _by: ConfirmResult["confirmedBy"],
): Promise<ConfirmResult> {
  throw new Error("clinic booking confirmation not implemented yet (track CLINIC)");
}
