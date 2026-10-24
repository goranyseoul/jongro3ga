import type { DemoBooking } from "@/lib/ui-data/ops";

// Client side calls to the demo control routes (05 "데모 컨트롤", app/api/demo/*). They work only with
// DEMO_MODE=true on the server.

async function call<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  const json = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(json.error ?? `${path} failed (${response.status})`);
  return json;
}

/** POST /api/demo/reset: back to data/seed, demo clock, empty task stores, offer cache refilled. */
export async function resetSeed(): Promise<void> {
  await call("/api/demo/reset");
}

/** POST /api/demo/inject-outcomes: the 20 Ara outcomes with a rising gap between quote and payment. */
export async function injectOutcomes(): Promise<{ injected: number; meanGapPct: number }> {
  return call("/api/demo/inject-outcomes");
}

/** POST /api/demo/clock: moves the fixed demo clock. */
export async function moveClock(to: string): Promise<{ now: string }> {
  return call("/api/demo/clock", { to });
}

/**
 * POST /api/demo/confirm-booking: proxy bookings are confirmed by the operator, direct ones by the clinic.
 * The card's id is sent; when it is not a real booking the server confirms the oldest waiting one.
 */
export async function confirmBooking(booking: DemoBooking): Promise<{ confirmedBy: "pibu_operator" | "clinic_staff" }> {
  return call("/api/demo/confirm-booking", { bookingId: booking.id });
}
