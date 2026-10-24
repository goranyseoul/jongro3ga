import { confirmClinicBooking, confirmProxyBooking } from "../agents/clinic/booking";
import { getProfile, listBookings, type ClinicBookingRecord } from "../agents/clinic/store";
import { resetTaskStores } from "../a2a/server";
import { clearAgentCardCache } from "../a2a/client";
import { refreshOfferCache } from "../agents/platform/offer-cache";
import { resetClock } from "../clock";
import { pibuGlobals } from "../pibu-globals";
import { resetStore } from "../store";
import { inProcessFetch } from "./in-process-fetch";

// Demo controls (05 "데모 컨트롤"). The platform matches from its clinic.offers cache, which is empty after a
// seed load, so every server entry point calls ensurePlatformReady() once per process before agents run.

declare module "../pibu-globals" {
  interface PibuGlobals {
    platformReady?: Promise<{ updated: string[]; failed: { clinicId: string; reason: string }[] }>;
  }
}

export const demoEnabled = (): boolean => process.env.DEMO_MODE === "true";

export function demoForbidden(): Response {
  return Response.json({ error: "demo controls need DEMO_MODE=true" }, { status: 403 });
}

/** Fills the platform's offer cache from the clinic agents, once per process (or after a reset). */
export function ensurePlatformReady() {
  const g = pibuGlobals();
  return (g.platformReady ??= refreshOfferCache({ fetchImpl: inProcessFetch }).then((result) => ({
    updated: [...result.updated],
    failed: result.failed.map((f) => ({ clinicId: f.clinicId, reason: f.reason })),
  })));
}

/** Back to the seed: store, clock, task stores, card cache, then the offer cache again. */
export async function resetDemo() {
  resetStore({ seed: true });
  resetClock();
  resetTaskStores();
  clearAgentCardCache();
  delete pibuGlobals().platformReady;
  return ensurePlatformReady();
}

// ---- bookings waiting for a clinic or the operator ----


/** Every booking still waiting for a clinic (direct) or the operator (proxy), oldest first. */
export async function pendingBookings(): Promise<(ClinicBookingRecord & { mode: "proxy" | "clinic" })[]> {
  const pending = await listBookings({ status: "pending_clinic" });
  const out: (ClinicBookingRecord & { mode: "proxy" | "clinic" })[] = [];
  for (const booking of pending) {
    if ((booking.inputRequested?.length ?? 0) > 0) continue;
    const mode = (await getProfile(booking.clinicId))?.operationMode ?? "clinic";
    out.push({ ...booking, mode });
  }
  return out.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

/** The demo's [예약 확정]: a proxy booking is confirmed as the operator, a direct one as the clinic. */
export async function confirmPendingBooking(bookingId?: string) {
  const pending = await pendingBookings();
  const booking = pending.find((b) => b.id === bookingId) ?? pending[0];
  if (!booking) return undefined;
  const confirm = booking.mode === "proxy" ? confirmProxyBooking : confirmClinicBooking;
  const result = await confirm(booking.id, { fetchImpl: inProcessFetch });
  return { bookingId: booking.id, clinicId: booking.clinicId, confirmedBy: booking.mode === "proxy" ? ("pibu_operator" as const) : ("clinic_staff" as const), booking: result };
}
