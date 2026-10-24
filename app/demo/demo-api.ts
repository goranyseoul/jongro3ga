import { ARA_BURST_COUNT, ARA_BURST_MEAN_GAP, type DemoBooking } from "@/lib/ui-data/ops";

// Mock stand-ins for the demo endpoints in 05-screens.md (POST /api/demo/...). Each one waits like a
// network call and returns the shape the real route would, so the screen can move to fetch() later
// without changing its callers.
const LATENCY_MS = 350;
const wait = () => new Promise<void>((resolve) => setTimeout(resolve, LATENCY_MS));

/** POST /api/demo/reset: back to data/seed. */
export async function resetSeed(): Promise<void> {
  await wait();
}

/** POST /api/demo/inject-outcomes: the 20 Ara outcomes with a rising gap between quote and payment. */
export async function injectOutcomes(): Promise<{ injected: number; meanGapPct: number }> {
  await wait();
  return { injected: ARA_BURST_COUNT, meanGapPct: Math.round(ARA_BURST_MEAN_GAP * 100) };
}

/** POST /api/demo/clock: moves the fixed demo clock. */
export async function moveClock(to: string): Promise<{ now: string }> {
  await wait();
  return { now: to };
}

/** POST /api/demo/confirm-booking: proxy bookings are confirmed by the operator, direct ones by the clinic. */
export async function confirmBooking(booking: DemoBooking): Promise<{ confirmedBy: "pibu_operator" | "clinic_staff" }> {
  await wait();
  return { confirmedBy: booking.mode === "proxy" ? "pibu_operator" : "clinic_staff" };
}
