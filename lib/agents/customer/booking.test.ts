import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clinicBookingIdForTask, confirmClinicBooking, confirmProxyBooking, rejectBooking } from "../../a2a/__fixtures__/clinic-admin";
import { routeFetch } from "../../a2a/__fixtures__/route-fetch";
import { proveOffer, verifyOffer } from "../../zk/client";
import { answerInput, bookQuote, pollBooking } from "./booking";
import { getRequestView, runRequest } from "./orchestrator";
import { customerStore, type StoredBooking, type StoredQuote } from "./store";
import { YUKI, bundleFor, catalog, draftYuki, logOf, setupCustomerTest, teardownCustomerTest } from "./__fixtures__/setup";

// 예약 대행 (02, 03 clinic.book with returnImmediately, 10 demo row 5): requested -> the clinic or the operator
// decides (lib/a2a/__fixtures__/clinic-admin.ts) -> GetTask polling -> confirmed with an automatic record.

vi.mock("../../zk/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../zk/client")>()),
  proveOffer: vi.fn(),
  verifyOffer: vi.fn(),
}));

beforeEach(async () => {
  await setupCustomerTest();
  vi.mocked(proveOffer).mockReset().mockImplementation(async (persona, offerId) => bundleFor(persona, offerId));
  vi.mocked(verifyOffer).mockReset().mockResolvedValue({ ok: true, reason: "verified" });
});
afterEach(teardownCustomerTest);

const FAST = { fetchImpl: routeFetch, pollIntervalMs: 5, pollTimeoutMs: 3_000 } as const;
const SLOT = "2026-11-14T11:00:00+09:00";

/** Yuki's request run to the comparison; the quote of `clinicId`. */
async function compare(clinicId: string): Promise<{ requestId: string; quote: StoredQuote }> {
  const draft = await draftYuki();
  await runRequest(draft.id, { fetchImpl: routeFetch, offerCatalog: catalog });
  const quote = (await getRequestView(draft.id))!.quotes.find((q) => q.quote.clinicId === clinicId)!;
  return { requestId: draft.id, quote };
}

const clinicBookingId = (booking: StoredBooking) => clinicBookingIdForTask(booking.clinicId, booking.clinicTaskId);

describe("bookQuote and pollBooking", () => {
  it("Seoul Glow 11/14 11:00: requested, the clinic confirms, the poll sees it and records the visit", async () => {
    const { requestId, quote } = await compare("cln_seoul_glow");
    expect(quote.quote.slots).toContain(SLOT);
    const booking = await bookQuote(requestId, quote.id, SLOT, { ...FAST, poll: "none" });
    expect(booking).toMatchObject({ status: "requested", clinicId: "cln_seoul_glow", slot: SLOT });
    expect(booking.clinicTaskId).toBeTruthy();
    expect((await customerStore.request(requestId))!.status).toBe("booking");

    // Still waiting: one poll round leaves it requested.
    expect((await pollBooking(booking.id, { ...FAST, pollTimeoutMs: 20 })).status).toBe("requested");

    await confirmClinicBooking(await clinicBookingId(booking), { fetchImpl: routeFetch });
    const done = await pollBooking(booking.id, FAST);
    expect(done.status).toBe("confirmed");
    expect(done.booking).toMatchObject({ schema: "pibu/booking@1", status: "confirmed", confirmedBy: "clinic_staff", priceKrw: 340_000, slot: SLOT });
    expect((await customerStore.request(requestId))!.status).toBe("booked");

    const record = (await customerStore.record(done.recordId!))!;
    expect(record).toMatchObject({
      customerId: YUKI.customerId,
      procedureId: "rejuran_healer",
      date: "2026-11-14",
      clinicId: "cln_seoul_glow",
      source: "booking",
      sessionNumber: 1,
      nextDue: "2026-12-14",
      priceKrw: 340_000,
      amount: { value: 2, unit: "cc" },
    });
    const drafts = await customerStore.outcomeDrafts(done.booking!.bookingId);
    expect(drafts.map((d) => d.checkpoint).sort()).toEqual(["D0", "D30", "D7"]);

    // The book call carried the referral token and the consent ref; the polls are GetTask on the same task.
    const log = await logOf(requestId);
    const book = log.find((e) => e.skillId === "clinic.book" && e.method === "SendMessage")!;
    const message = (book.request as { params: { message: { metadata: Record<string, unknown>; extensions: string[] }; configuration: Record<string, unknown> } }).params;
    expect(message.message.metadata).toMatchObject({ consentRef: "cns_0005" });
    expect(message.message.metadata.referralToken).toBeTruthy();
    expect(message.configuration.returnImmediately).toBe(true);
    expect(log.filter((e) => e.method === "GetTask" && e.taskId === booking.clinicTaskId).length).toBeGreaterThanOrEqual(2);
  });

  it("Mint (proxy): the operator confirms from the proxy queue", async () => {
    const { requestId, quote } = await compare("cln_mint");
    const slot = quote.quote.slots[0]!;
    const booking = await bookQuote(requestId, quote.id, slot, { ...FAST, poll: "none" });
    await expect(confirmClinicBooking(await clinicBookingId(booking), { fetchImpl: routeFetch })).rejects.toThrow(/confirmProxyBooking/);
    await confirmProxyBooking(await clinicBookingId(booking), { fetchImpl: routeFetch });
    const done = await pollBooking(booking.id, FAST);
    expect(done.status).toBe("confirmed");
    expect(done.booking).toMatchObject({ confirmedBy: "pibu_operator", priceKrw: 99_000 });
  });

  it("a rejection ends the booking as canceled with the clinic's reason and the request back to comparing", async () => {
    const { requestId, quote } = await compare("cln_ara");
    const booking = await bookQuote(requestId, quote.id, quote.quote.slots[0]!, { ...FAST, poll: "none" });
    await rejectBooking(await clinicBookingId(booking), "fully booked");
    const done = await pollBooking(booking.id, FAST);
    expect(done.status).toBe("canceled");
    expect(done.endReason).toBe("booking_rejected: fully booked");
    expect(done.recordId).toBeUndefined();
    expect((await customerStore.request(requestId))!.status).toBe("comparing");
  });

  it("the default background poll picks up the confirmation, and a second pollBooking joins it", async () => {
    const { requestId, quote } = await compare("cln_seoul_glow");
    const booking = await bookQuote(requestId, quote.id, SLOT, FAST);
    await confirmClinicBooking(await clinicBookingId(booking), { fetchImpl: routeFetch });
    const done = await pollBooking(booking.id, FAST);
    expect(done.status).toBe("confirmed");
    expect((await customerStore.records(YUKI.customerId)).filter((r) => r.source === "booking")).toHaveLength(1);
  });
});

describe("INPUT_REQUIRED (03 input-request@1)", () => {
  it("answers the consented field itself, leaves the rest to the customer, then goes on", async () => {
    // Safety info is not shared with clinics, so the clinic asks for the passport name and the last Rejuran date.
    const profile = (await customerStore.profile(YUKI.customerId))!;
    await customerStore.putProfile({ ...profile, passportName: "TANAKA YUKI" });
    const share = (await customerStore.consents(YUKI.customerId)).find((c) => c.id === "cns_0005")!;
    const { getStore } = await import("../../store");
    await getStore().put("customer", "consents", { ...share, scope: ["contact.handle", "guest.passportName"] });

    const { requestId, quote } = await compare("cln_seoul_glow");
    const booking = await bookQuote(requestId, quote.id, SLOT, { ...FAST, poll: "none" });
    // The agent sent the passport name on the same task; the treatment date it never sends on its own.
    expect(booking.status).toBe("requested");
    expect(booking.pendingInput?.map((f) => f.key)).toEqual(["lastRejuranDate"]);
    const answers = (await logOf(requestId)).filter((e) => e.skillId === "clinic.book" && e.method === "SendMessage");
    expect(answers).toHaveLength(2);
    const values = (answers[1]!.request as { params: { message: { taskId: string; parts: Array<{ data?: { schema: string; values: Record<string, string> } }> } } }).params.message;
    expect(values.taskId).toBe(booking.clinicTaskId);
    const data = values.parts.find((p) => p.data)!.data!;
    expect(data.schema).toBe("pibu/input-response@1");
    expect(Object.keys(data.values)).toEqual(["passportName"]);
    expect(answers[1]!.state).toBe("TASK_STATE_INPUT_REQUIRED");

    // The customer answers on the booking screen (WP7), the clinic takes the booking and confirms.
    const answered = await answerInput(booking.id, { lastRejuranDate: "none" }, { ...FAST, poll: "none" });
    expect(answered.pendingInput).toBeUndefined();
    expect(answered.status).toBe("requested");
    await confirmClinicBooking(await clinicBookingId(booking), { fetchImpl: routeFetch });
    expect((await pollBooking(booking.id, FAST)).status).toBe("confirmed");
  });

  it("asks the customer for everything when the ledger covers none of the fields", async () => {
    const share = (await customerStore.consents(YUKI.customerId)).find((c) => c.id === "cns_0005")!;
    const { getStore } = await import("../../store");
    await getStore().put("customer", "consents", { ...share, scope: ["contact.handle"] });
    const { requestId, quote } = await compare("cln_seoul_glow");
    const booking = await bookQuote(requestId, quote.id, SLOT, { ...FAST, poll: "none" });
    expect(booking.pendingInput?.map((f) => f.key)).toEqual(["passportName", "lastRejuranDate"]);
    expect((await logOf(requestId)).filter((e) => e.skillId === "clinic.book" && e.method === "SendMessage")).toHaveLength(1);
  });
});
