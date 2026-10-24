import { listBookings, pollBooking, bookQuote } from "../agents/customer/booking";
import { draftRequest } from "../agents/customer/intent";
import { getRequestView, runRequest } from "../agents/customer/orchestrator";
import { submitOutcome } from "../agents/customer/outcomes";
import type { StoredBooking } from "../agents/customer/store";
import { ensurePlatformReady } from "./demo";
import { inProcessFetch } from "./in-process-fetch";

// Demo driver for 10 데모 2~6행: the /demo console's buttons run Yuki's request through the customer agent
// (lib/agents/customer) while the customer screens still show their scripted data. The agent drafts the request
// from Yuki's sentence, matches, proves offers on device, collects quotes, judges and books; every call it makes
// is real A2A, so the log fills the same way the screens will fill it (WP7).

const YUKI = { customerId: "cus_yuki_done" } as const;
const UTTERANCE = "リジュラン受けたい";
const GLOW = "cln_seoul_glow";
const opts = { fetchImpl: inProcessFetch };

interface Quote {
  quoteId: string;
  clinicId: string;
  procedureId: string;
  amount: { value: number; unit: string };
  priceKrw: number;
  vatIncluded: boolean;
  includes: string[];
  slots: string[];
  offerApplied?: unknown;
}

type Step = { step: string; state: string; detail?: string };

export interface ScenarioResult {
  requestId: string;
  steps: Step[];
  quotes: Quote[];
  verdicts: unknown[];
  booking?: { taskId: string; clinicId: string; state: string };
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Yuki: the customer agent drafts "リジュラン受けたい", runs it to the comparison and books Seoul Glow 11/14 11:00. */
export async function runYukiScenario(): Promise<ScenarioResult> {
  await ensurePlatformReady();
  const drafted = await draftRequest(YUKI.customerId, UTTERANCE, opts);
  if (!drafted.ok) {
    return { requestId: drafted.requestId, steps: [{ step: "customer.draft", state: "missing", detail: drafted.missing.join(", ") }], quotes: [], verdicts: [] };
  }
  const requestId = drafted.request.id;
  const done = await runRequest(requestId, opts);
  const view = await getRequestView(requestId);
  const stored = view?.quotes ?? [];
  const result: ScenarioResult = {
    requestId,
    steps: [
      { step: "customer.draft", state: "ok", detail: drafted.mode },
      ...done.steps.map((s) => ({ step: s.kind, state: "ok", detail: s.text.ko ?? s.clinicId ?? "" })),
      { step: "customer.request", state: done.status, ...(done.failure ? { detail: done.failure.reason } : {}) },
    ],
    quotes: stored.map((q) => q.quote as Quote),
    verdicts: stored.flatMap((q) => (q.verdict ? [q.verdict] : [])),
  };
  if (done.status !== "comparing") return result;

  const glow = stored.find((q) => q.quote.clinicId === GLOW);
  if (!glow) return result;
  const slot = glow.quote.slots.find((s) => s.startsWith("2026-11-14T11:00")) ?? glow.quote.slots[0];
  if (!slot) return result;
  try {
    // The agent polls the clinic task in the background; [예약 확정] on the clinic side completes it.
    const booked = await bookQuote(requestId, glow.id, slot, { ...opts, poll: "background" });
    result.steps.push({ step: "clinic.book", state: booked.status });
    result.booking = { taskId: booked.clinicTaskId, clinicId: GLOW, state: booked.status };
  } catch (error) {
    result.steps.push({ step: "clinic.book", state: "error", detail: message(error) });
  }
  return result;
}

// ---- 10 데모 6행: D0 outcome after the clock moved to the treatment day ----

const POLL_GRACE_MS = 5_000;

/** Yuki's newest booking as the agent knows it, after one more look at the clinic task if it is still waiting. */
async function latestBooking(): Promise<StoredBooking | undefined> {
  const latest = (await listBookings(YUKI.customerId))[0];
  if (!latest || latest.status !== "requested") return latest;
  // The background poll looks every 3 seconds; the clinic may have confirmed since its last look.
  const polled = pollBooking(latest.id, { ...opts, pollTimeoutMs: 0 }).catch(() => latest);
  const grace = new Promise<StoredBooking>((resolve) => setTimeout(() => resolve(latest), POLL_GRACE_MS));
  await Promise.race([polled, grace]);
  return (await listBookings(YUKI.customerId)).find((b) => b.id === latest.id) ?? latest;
}

/** Yuki's confirmed booking: the customer agent submits the D0 outcome, anchors the visit and renumbers the record. */
export async function submitYukiD0(): Promise<{ bookingId?: string; steps: Step[] }> {
  const booking = await latestBooking();
  if (!booking) return { steps: [{ step: "find_booking", state: "none", detail: "no Yuki booking" }] };
  if (!booking.booking || booking.status !== "confirmed") {
    return { steps: [{ step: "find_booking", state: booking.status, detail: "the clinic has not confirmed Yuki's booking yet" }] };
  }
  const result = await submitOutcome(
    booking.id,
    {
      checkpoint: "D0",
      paidKrw: booking.booking.priceKrw,
      receivedAmount: { value: 2, unit: "cc" },
      productVerified: "vial_shown",
      receiptAttached: true,
      satisfaction: 5,
      painScore: 3,
      downtimeDaysActual: null,
      wouldReturn: true,
      comment: "Explained everything in Japanese.",
    },
    opts,
  );
  const steps: Step[] = [
    result.sent
      ? { step: "platform.submit_outcome", state: "TASK_STATE_COMPLETED" }
      : { step: "platform.submit_outcome", state: "failed", ...(result.platformText ? { detail: result.platformText } : {}) },
  ];
  if (result.anchor) {
    steps.push(
      result.anchor.anchored
        ? { step: "platform.anchor_record", state: "TASK_STATE_COMPLETED", detail: result.anchor.tx }
        : { step: "platform.anchor_record", state: "skipped", detail: result.anchor.reason },
    );
  }
  if (result.record) {
    steps.push({ step: "customer.record", state: "ok", detail: `session ${result.record.sessionNumber}, next ${result.record.nextDue ?? "none"}` });
  }
  return { bookingId: booking.booking.bookingId, steps };
}
