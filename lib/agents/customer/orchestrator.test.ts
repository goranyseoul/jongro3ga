import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OutcomeV1Schema, ProcedureRequestForClinicSchema, type ProcedureRequestV1 } from "../../a2a/schemas";
import { resetClock, setClock } from "../../clock";
import type { TreatmentRecord } from "../../domain/customer";
import { createMemoryStore, type MemoryStore } from "../../store/memory";
import { setConsent } from "./consent";
import { createMockA2A, MOCK_BASE_URL, type MockA2AOptions } from "./mock-a2a";
import {
  OrchestratorError,
  answerCheckin,
  bookQuote,
  createDraft,
  defaultDeps,
  pollBooking,
  runRequest,
  submitOutcome,
  type OrchestratorDeps,
} from "./orchestrator";
import { addRecord, listRecords } from "./records";
import { ensureDemoCustomer } from "./seed";
import { D0_ANCHOR } from "../../ui-data/customer";
import { C, listOf, type InboxItem, type StoredBooking, type StoredQuote } from "./store";

const YUKI = "cus_yuki_done";
const NOW = "2026-11-12T10:00:00+09:00";

let store: MemoryStore;

function setup(options: MockA2AOptions = {}, overrides: Partial<OrchestratorDeps> = {}) {
  const mock = createMockA2A(options);
  const completer = { complete: vi.fn(async () => undefined) };
  const deps = defaultDeps({
    store,
    baseUrl: MOCK_BASE_URL,
    send: mock.send,
    get: mock.get,
    completer,
    sleep: async () => undefined,
    zk: { enabled: () => false, matchOffers: async () => null, proveOffer: async () => null },
    ...overrides,
  });
  return { mock, deps, completer };
}

const skills = (mock: ReturnType<typeof createMockA2A>) => mock.calls.map((c) => c.skillId);

beforeEach(async () => {
  vi.stubEnv("DEMO_MODE", "true");
  setClock(NOW);
  store = createMemoryStore();
  await ensureDemoCustomer(store, YUKI);
  await ensureDemoCustomer(store, "cus_jisoo");
});

afterEach(() => {
  resetClock();
  vi.unstubAllEnvs();
});

async function startYuki(deps: OrchestratorDeps) {
  const draft = await createDraft(deps, YUKI, { procedureId: "rejuran_healer" }, "リジュラン受けたい");
  return runRequest(deps, YUKI, draft.id);
}

describe("customer orchestrator: recipe -> match -> parallel quotes -> judge", () => {
  it("fills the usual minimum amount from platform.recipe and the defaults of 02", async () => {
    const { deps, mock } = setup();
    const draft = await createDraft(deps, YUKI, { procedureId: "rejuran_healer" }, "リジュラン受けたい");
    expect(skills(mock)).toEqual(["platform.recipe"]);
    expect(mock.calls[0]?.contextId).toBe(draft.id);
    expect(draft.status).toBe("draft");
    expect(draft.request.amount).toEqual({ value: 2, unit: "cc" });
    expect(draft.request.budgetKrw).toEqual({ max: 450000 });
    expect(draft.request.areas).toEqual(["sinsa", "gangnam", "apgujeong"]);
    expect(draft.request.languages).toEqual(["ja"]);
    expect(draft.request.dateWindow).toEqual({ from: "2026-11-13", to: "2026-11-15" });
    expect(draft.request.visitorProfile).toEqual({ nationality: "JP", residency: "short_term_visitor", ageBand: "25-29", firstKProcedure: true });
  });

  it("reaches comparing with the three 07 reference quotes and the platform's labels on the right rows", async () => {
    const { deps, mock } = setup();
    const { request, quotes } = await startYuki(deps);
    expect(request.status).toBe("comparing");
    expect(request.matchId).toBe("mt_4401");
    expect(skills(mock)).toEqual(["platform.recipe", "platform.match_clinics", "clinic.quote", "clinic.quote", "clinic.quote", "platform.judge_quote"]);

    const byClinic = Object.fromEntries(quotes.map((q) => [q.quote.clinicId, q]));
    expect(Object.keys(byClinic).sort()).toEqual(["cln_ara", "cln_mint", "cln_seoul_glow"]);
    expect(byClinic.cln_mint?.verdict?.label).toBe("underdosed");
    expect(byClinic.cln_mint?.quote.amount).toEqual({ value: 1, unit: "cc" });
    expect(byClinic.cln_seoul_glow?.verdict?.label).toBe("fair");
    expect(byClinic.cln_seoul_glow?.verdict?.normalizedUnitKrw).toBe(170000);
    expect(byClinic.cln_ara?.verdict?.label).toBe("fair");
    expect(byClinic.cln_ara?.verdict?.normalizedUnitKrw).toBe(165000);
    expect(byClinic.cln_ara?.verdict?.clinicFlags.map((f) => f.code)).toContain("paid_more_than_quoted");

    // verdicts are persisted with the quotes, not only returned
    const stored = await listOf<StoredQuote>(store, C.quotes, { requestId: request.id });
    expect(stored.filter((q) => q.verdict).length).toBe(3);

    // judge_quote got every quote it received
    const judge = mock.calls.find((c) => c.skillId === "platform.judge_quote");
    expect((judge?.data.quotes as unknown[]).length).toBe(3);
  });

  it("sends every clinic only the minimized copy, with that clinic's referral token", async () => {
    const { deps, mock } = setup();
    await startYuki(deps);
    const quoteCalls = mock.calls.filter((c) => c.skillId === "clinic.quote");
    expect(quoteCalls).toHaveLength(3);
    for (const call of quoteCalls) {
      const data = call.data as ProcedureRequestV1;
      expect(ProcedureRequestForClinicSchema.safeParse(data).success).toBe(true);
      expect(data).not.toHaveProperty("budgetKrw");
      expect(data).not.toHaveProperty("notes");
      expect(data.visitorProfile).toEqual({ nationality: "JP", firstKProcedure: true });
      const clinicSlug = call.toCardUrl.match(/clinics\/([^/]+)\//)?.[1];
      expect(call.metadata?.referralToken).toMatch(/^ref\.cln_/);
      expect(String(call.metadata?.referralToken)).toContain(clinicSlug === "seoul-glow" ? "cln_seoul_glow" : `cln_${clinicSlug}`);
      expect(call.timeoutMs).toBe(20_000);
    }
    // the platform copy keeps what matching needs
    const match = mock.calls.find((c) => c.skillId === "platform.match_clinics")?.data as ProcedureRequestV1;
    expect(match.visitorProfile.residency).toBe("short_term_visitor");
    expect(match.visitorProfile.ageBand).toBe("25-29");
  });

  it("moves on without a clinic that does not answer in time and reports the timeout", async () => {
    const { deps, mock } = setup({ silentClinics: ["cln_ara"] }, { quoteTimeoutMs: 40 });
    const { request, quotes, shortlist } = await startYuki(deps);
    expect(request.status).toBe("comparing");
    expect(quotes.map((q) => q.quote.clinicId).sort()).toEqual(["cln_mint", "cln_seoul_glow"]);
    expect(shortlist?.failures).toEqual([{ clinicId: "cln_ara", kind: "response_timeout" }]);
    const signals = mock.calls.filter((c) => c.skillId === "platform.report_signal");
    expect(signals).toHaveLength(1);
    expect(signals[0]?.data).toMatchObject({ schema: "pibu/signal-report@1", clinicId: "cln_ara", kind: "response_timeout", requestId: request.id, at: NOW });
    // judge only got the answers that arrived
    const judge = mock.calls.find((c) => c.skillId === "platform.judge_quote");
    expect((judge?.data.quotes as unknown[]).length).toBe(2);
  });

  it("reports a rejection with the clinic's task id", async () => {
    const { deps, mock } = setup({ rejectingClinics: ["cln_mint"] });
    const { quotes, shortlist } = await startYuki(deps);
    expect(quotes).toHaveLength(2);
    expect(shortlist?.failures[0]).toMatchObject({ clinicId: "cln_mint", kind: "rejection" });
    const signal = mock.calls.find((c) => c.skillId === "platform.report_signal");
    expect(signal?.data).toMatchObject({ kind: "rejection", clinicId: "cln_mint" });
    expect(String(signal?.data.taskId)).toMatch(/^tsk_mock_/);
  });

  it("fails cleanly when no clinic answers, and when the platform is down", async () => {
    const allSilent = setup({ silentClinics: ["cln_ara", "cln_mint", "cln_seoul_glow"] }, { quoteTimeoutMs: 20 });
    expect((await startYuki(allSilent.deps)).request).toMatchObject({ status: "failed", failure: "no_quotes" });
    expect(allSilent.mock.calls.filter((c) => c.skillId === "platform.report_signal")).toHaveLength(3);

    const down = setup({}, { send: async (o) => (o.skillId === "platform.match_clinics" ? Promise.reject(new Error("ECONNREFUSED")) : createMockA2A().send(o)) });
    expect((await startYuki(down.deps)).request).toMatchObject({ status: "failed", failure: "platform_unavailable" });
  });

  it("does not open matching to Korean nationals (08 section 2)", async () => {
    const { deps, mock } = setup();
    await expect(createDraft(deps, "cus_jisoo", { procedureId: "rejuran_healer" }, "리쥬란")).rejects.toMatchObject({ code: "not_eligible" });
    expect(mock.calls).toHaveLength(0);
  });

  it("attaches a ZK offer proof only to clinics with an eligible offer and never sends treatment history", async () => {
    await addRecord(store, YUKI, { procedureId: "rejuran_healer", date: "2026-10-01", clinicName: "Secret Clinic", priceKrw: 123456 });
    const proveOffer = vi.fn(async (_persona: string, offerId: string) => ({ subjectId: "0xabc", offerId, today: 1, proofs: [{ proof: "0x1", publicInputs: ["c"] }] }));
    const matchOffers = vi.fn(async () => [
      { clinicId: "cln_mint", offerId: "ofr_mint_second", title: "2nd session", eligible: true },
      { clinicId: "cln_ara", offerId: "ofr_ara_first", title: "First visit", eligible: false },
    ]);
    const { deps, mock } = setup({}, { zk: { enabled: () => true, matchOffers, proveOffer } });
    await startYuki(deps);
    expect(matchOffers).toHaveBeenCalledWith("cus_yuki");
    expect(proveOffer).toHaveBeenCalledTimes(1);
    expect(proveOffer).toHaveBeenCalledWith("cus_yuki", "ofr_mint_second");
    const quoteCalls = mock.calls.filter((c) => c.skillId === "clinic.quote");
    const withProof = quoteCalls.filter((c) => c.metadata?.zkOfferProof);
    expect(withProof.map((c) => c.toCardUrl)).toEqual([expect.stringContaining("/clinics/mint/")]);
    const wire = JSON.stringify(mock.calls);
    expect(wire).not.toContain("2026-10-01");
    expect(wire).not.toContain("Secret Clinic");
    expect(wire).not.toContain("123456");
  });
});

describe("booking: clinic.book with returnImmediately, then GetTask polling", () => {
  it("polls until the clinic confirms, then marks the request booked and leaves a confirmation in the inbox", async () => {
    const { deps, mock } = setup({ confirmAfterPolls: 3 });
    const { request } = await startYuki(deps);
    const booking = await bookQuote(deps, YUKI, { requestId: request.id, quoteId: "qt_1203", slot: "2026-11-14T11:00:00+09:00" });
    expect(booking.status).toBe("pending_clinic");

    const book = mock.calls.find((c) => c.skillId === "clinic.book");
    expect(book?.returnImmediately).toBe(true);
    expect(book?.metadata?.referralToken).toBe("ref.cln_seoul_glow.sig");
    expect(String(book?.metadata?.consentRef)).toMatch(/^cns_/);
    expect(book?.data).toMatchObject({ schema: "pibu/booking-request@1", quoteId: "qt_1203", clinicId: "cln_seoul_glow", slot: "2026-11-14T11:00:00+09:00" });

    const confirmed = await pollBooking(deps, YUKI, booking.id);
    expect(mock.polls).toHaveLength(3);
    expect(confirmed.status).toBe("confirmed");
    expect(confirmed.booking?.bookingId).toBe("bkg_5521");
    expect(confirmed.booking?.confirmedBy).toBe("clinic_staff");

    const stored = await listOf<StoredBooking>(store, C.bookings, { requestId: request.id });
    expect(stored[0]?.status).toBe("confirmed");
    const inbox = await listOf<InboxItem>(store, C.inbox, { customerId: YUKI });
    expect(inbox.map((i) => i.kind)).toContain("booking_confirmed");
    const { requestView } = await import("./bff");
    expect((await requestView(store, YUKI, request.id))?.request.status).toBe("booked");
  });

  it("stops polling at the 10 minute limit when the clinic never confirms", async () => {
    const { deps, mock } = setup({ confirmAfterPolls: 10_000 }, { pollIntervalMs: 3_000, pollMaxMs: 15_000 });
    const { request } = await startYuki(deps);
    const booking = await bookQuote(deps, YUKI, { requestId: request.id, quoteId: "qt_1203", slot: "2026-11-14T11:00:00+09:00" });
    const after = await pollBooking(deps, YUKI, booking.id);
    expect(after.status).toBe("pending_clinic");
    expect(mock.polls).toHaveLength(5);
  });

  it("refuses slots the quote did not offer and a second booking for the same request", async () => {
    const { deps } = setup();
    const { request } = await startYuki(deps);
    await expect(bookQuote(deps, YUKI, { requestId: request.id, quoteId: "qt_1203", slot: "2026-11-14T09:00:00+09:00" })).rejects.toBeInstanceOf(OrchestratorError);
    await bookQuote(deps, YUKI, { requestId: request.id, quoteId: "qt_1203", slot: "2026-11-14T11:00:00+09:00" });
    await expect(bookQuote(deps, YUKI, { requestId: request.id, quoteId: "qt_88a1", slot: "2026-11-14T11:00:00+09:00" })).rejects.toMatchObject({ code: "already_booked" });
  });

  it("needs the clinic sharing consent to book", async () => {
    const { deps, mock } = setup();
    const { request } = await startYuki(deps);
    await setConsent(store, YUKI, "shareWithClinic", false);
    await expect(bookQuote(deps, YUKI, { requestId: request.id, quoteId: "qt_1203", slot: "2026-11-14T11:00:00+09:00" })).rejects.toMatchObject({ code: "consent_required" });
    expect(mock.calls.some((c) => c.skillId === "clinic.book")).toBe(false);
  });
});

describe("D0 outcome and check-ins", () => {
  async function confirmedBooking(deps: OrchestratorDeps) {
    const { request } = await startYuki(deps);
    const booking = await bookQuote(deps, YUKI, { requestId: request.id, quoteId: "qt_1203", slot: "2026-11-14T11:00:00+09:00" });
    return pollBooking(deps, YUKI, booking.id);
  }

  const form = { paidKrw: 340000, receivedAmount: { value: 2, unit: "cc" as const }, productVerified: "vial_shown", satisfaction: 5, painScore: 3, wouldReturn: true, comment: "Explained everything in Japanese." };

  it("submits a valid pibu/outcome@1 with the clinic's booking id and records the next session", async () => {
    const { deps, mock } = setup();
    const booking = await confirmedBooking(deps);
    setClock("2026-11-14T13:00:00+09:00");
    const result = await submitOutcome(deps, YUKI, booking.id, form);

    const call = mock.calls.find((c) => c.skillId === "platform.submit_outcome");
    expect(call?.data).toEqual(result.outcome);
    expect(OutcomeV1Schema.safeParse(call?.data).success).toBe(true);
    expect(result.outcome).toMatchObject({
      schema: "pibu/outcome@1",
      bookingId: "bkg_5521",
      clinicId: "cln_seoul_glow",
      procedureId: "rejuran_healer",
      checkpoint: "D0",
      paidKrw: 340000,
      receivedAmount: { value: 2, unit: "cc" },
      productVerified: "vial_shown",
      receiptAttached: false,
      satisfaction: 5,
      painScore: 3,
      downtimeDaysActual: null,
      wouldReturn: true,
      sideEffects: [],
      comment: "Explained everything in Japanese.",
      visitorProfile: { nationality: "JP", ageBand: "25-29" },
      submittedAt: "2026-11-14T13:00:00+09:00",
    });
    expect(Object.keys(result.outcome.visitorProfile).sort()).toEqual(["ageBand", "nationality"]);
    expect(result.sent).toBe(true);

    // the booked procedure is recorded: session 1 on 11-14, session 2 due on 12-14
    const records = await listRecords(store, YUKI);
    const record = records.find((r: TreatmentRecord) => r.source === "booking");
    expect(record).toMatchObject({ procedureId: "rejuran_healer", date: "2026-11-14", sessionNumber: 1, nextDue: "2026-12-14", priceKrw: 340000, sharedToPlatform: true });
    // the clinic-confirmed visit is appended to Yuki's chart (ZK record layer, demo anchor values)
    expect(record?.anchor).toMatchObject({ version: 1, tx: D0_ANCHOR.tx, recordHash: D0_ANCHOR.recordHash });

    // D7 and D30 are due items in the inbox, not sent anywhere
    const inbox = await listOf<InboxItem>(store, C.inbox, { customerId: YUKI });
    const checkins = inbox.filter((i) => i.kind === "checkin_due").map((i) => [i.checkpoint, i.dueAt]);
    expect(checkins).toEqual([
      ["D7", "2026-11-21T10:00:00+09:00"],
      ["D30", "2026-12-14T10:00:00+09:00"],
    ]);
  });

  it("keeps the outcome local without the anonymized sharing consent", async () => {
    const { deps, mock } = setup();
    const booking = await confirmedBooking(deps);
    await setConsent(store, YUKI, "shareAnonymizedRecords", false);
    const result = await submitOutcome(deps, YUKI, booking.id, form);
    expect(result.sent).toBe(false);
    expect(mock.calls.some((c) => c.skillId === "platform.submit_outcome")).toBe(false);
    expect(result.record.sharedToPlatform).toBe(false);
  });

  it("answers a D7 check-in with submit_outcome built on the D0 values", async () => {
    const { deps, mock } = setup();
    const booking = await confirmedBooking(deps);
    await submitOutcome(deps, YUKI, booking.id, form);
    setClock("2026-11-21T12:00:00+09:00");
    const d7 = (await listOf<InboxItem>(store, C.inbox, { customerId: YUKI })).find((i) => i.checkpoint === "D7");
    const { outcome, sent } = await answerCheckin(deps, YUKI, d7!.id, { satisfaction: 4, downtimeDaysActual: 2, wouldReturn: true });
    expect(sent).toBe(true);
    expect(outcome).toMatchObject({ checkpoint: "D7", satisfaction: 4, downtimeDaysActual: 2, paidKrw: 340000, bookingId: "bkg_5521" });
    expect(mock.calls.filter((c) => c.skillId === "platform.submit_outcome")).toHaveLength(2);
  });
});
