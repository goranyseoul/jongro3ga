import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeFetch } from "../../a2a/__fixtures__/route-fetch";
import { issueReferralToken } from "../../a2a/auth";
import { A2AClientError, clearAgentCardCache, getTask, sendMessage } from "../../a2a/client";
import { listA2ALog } from "../../a2a/log";
import { BookingV1Schema, InputRequestV1Schema, QuoteV1Schema, type SkillId } from "../../a2a/schemas";
import { resetTaskStores } from "../../a2a/server";
import { taskArtifactData, type WireTask } from "../../a2a/wire";
import { resetClock, setClock } from "../../clock";
import { getStore, resetStore } from "../../store";
import { verifyOffer } from "../../zk/client";
import { confirmClinicBooking, confirmProxyBooking, rejectBooking } from "./booking";
import { listProxyQueue } from "./proxy";
import { listInbox } from "./admin";
import { getSlot, listBookings } from "./store";

// T05 and the clinic side of T18 (10-build-plan.md), through the real rpc route: lib/a2a/client -> routeFetch ->
// app/a2a/clinics/[slug]/rpc -> clinicExecutor. Only the glowpass verifier (lib/zk/client) is mocked.

vi.mock("../../zk/client", () => ({ verifyOffer: vi.fn() }));
const verifyMock = vi.mocked(verifyOffer);

const BASE = "https://pibu.example";
const yuki = { agentId: "cag_7f3k2", role: "customer" as const };
const CLINICS = {
  "seoul-glow": "cln_seoul_glow",
  mint: "cln_mint",
  ara: "cln_ara",
  hanbit: "cln_hanbit",
  dahye: "cln_dahye",
} as const;
type Slug = keyof typeof CLINICS;
const cardOf = (slug: Slug) => `${BASE}/a2a/clinics/${slug}/agent-card.json`;

const referral = (clinicId: string) =>
  issueReferralToken({ clinicId, customerAgentId: yuki.agentId, requestId: "req_01J9Z8", matchId: "mt_4401" });

const procedureRequest = (extra: Record<string, unknown> = {}) => ({
  schema: "pibu/procedure-request@1",
  requestId: "req_01J9Z8",
  customerAgentId: yuki.agentId,
  procedureId: "rejuran_healer",
  amount: { value: 2, unit: "cc" },
  languages: ["ja"],
  dateWindow: { from: "2026-11-13", to: "2026-11-15" },
  visitorProfile: { nationality: "JP", firstKProcedure: true },
  ...extra,
});

const offerProof = (offerId: string, clinicId: string, extra: Record<string, unknown> = {}) => ({
  schema: "pibu/offer-proof@1",
  offerId,
  clinicId,
  subjectId: "0x5c0d6f0a8c2e4b1f9d3a7e6c5b4a39281716050403020100ffeeddccbbaa9988",
  chainId: 84532,
  registry: "0xcf47152e720508bf8c757a55aa30956ca8b58857",
  today: 29880272,
  proofs: [{ proof: "0x1f2e3d4c", publicInputs: ["0x0b1c2d3e", "29880272", "0", "2", "0", "100000", "0", "0"] }],
  ...extra,
});

async function call(
  slug: Slug,
  skillId: SkillId,
  data: Record<string, unknown>,
  metadata: Record<string, unknown> = {},
  taskId?: string,
): Promise<WireTask> {
  return sendMessage({
    from: yuki,
    toCardUrl: cardOf(slug),
    skillId,
    data,
    contextId: "req_01J9Z8",
    metadata,
    ...(taskId === undefined ? {} : { taskId }),
    fetchImpl: routeFetch,
  });
}

async function quote(slug: Slug, opts: { data?: Record<string, unknown>; metadata?: Record<string, unknown> } = {}) {
  return call(slug, "clinic.quote", opts.data ?? procedureRequest(), {
    referralToken: await referral(CLINICS[slug]),
    ...opts.metadata,
  });
}

const quoteOf = (task: WireTask) => QuoteV1Schema.parse(taskArtifactData(task));
const statusText = (task: WireTask) => (task.status.message?.parts ?? []).map((p) => (p as { text?: string }).text).join(" ");

const bookingRequest = (q: { quoteId: string; clinicId: string }, slot: string, extra: Record<string, unknown> = {}) => ({
  schema: "pibu/booking-request@1",
  requestId: "req_01J9Z8",
  quoteId: q.quoteId,
  clinicId: q.clinicId,
  slot,
  guest: { displayName: "Yuki T.", contactChannel: "line", contactHandle: "yuki_demo", language: "ja" },
  safetyInfo: { pregnantOrBreastfeeding: false, allergies: [], anticoagulants: false, recentIsotretinoin: false, keloidHistory: false },
  consentRef: "cns_0091",
  ...extra,
});

/** Quotes, then books `slot` at the clinic with the same referral flow the customer agent uses. */
async function quoteAndBook(slug: Slug, slot: string, extra: Record<string, unknown> = {}, data?: Record<string, unknown>) {
  const q = quoteOf(await quote(slug, data ? { data } : {}));
  const task = await call(slug, "clinic.book", bookingRequest(q, slot, extra), { referralToken: await referral(CLINICS[slug]) });
  return { q, task };
}

const bookingFor = async (taskId: string) => (await listBookings({ a2aTaskId: taskId }))[0]!;
const reportCalls = () => listA2ALog(getStore(), { skillId: "platform.report_booking", method: "SendMessage" });

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("PUBLIC_BASE_URL", BASE);
  // An autoConfirm booking reports to the platform from inside the executor, with the default fetch.
  vi.stubGlobal("fetch", routeFetch);
  setClock("2026-11-12T10:00:00+09:00");
  resetStore({ seed: true });
  resetTaskStores();
  clearAgentCardCache();
  verifyMock.mockReset();
});

afterEach(() => {
  resetClock();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("clinic.quote: item choice and offer proofs (07, BUILD-LOG 22)", () => {
  it("Mint 2cc with a verified first visit proof: the 1cc event at 99,000 with offerApplied", async () => {
    verifyMock.mockResolvedValue({ ok: true, reason: "verified" });
    const task = await quote("mint", { metadata: { offerProof: offerProof("ofr_mint_rejuran_first_visit", "cln_mint") } });
    expect(task.status.state).toBe("TASK_STATE_COMPLETED");
    const q = quoteOf(task);
    expect(q).toMatchObject({ clinicId: "cln_mint", amount: { value: 1, unit: "cc" }, priceKrw: 99000, vatIncluded: true, indicative: true, operationMode: "proxy" });
    expect(q.event).toEqual({
      title: "첫 방문 1cc 이벤트",
      regularPriceKrw: 150000,
      validFrom: "2026-11-01",
      validUntil: "2026-11-30",
      conditions: "첫 방문 한정",
      zkClauses: [{ clinicId: "cln_mint", maxCount: 0 }],
    });
    expect(q.offerApplied).toEqual({ offerId: "ofr_mint_rejuran_first_visit", verified: true });
    expect(q.validUntil).toBe("2026-11-19");
    expect(q.slots).toHaveLength(12);
    expect(verifyMock).toHaveBeenCalledWith("cln_mint", expect.objectContaining({ offerId: "ofr_mint_rejuran_first_visit", today: 29880272 }));
  });

  it("Mint without a proof: the regular price 150,000 for 1cc, no event and no offerApplied", async () => {
    const q = quoteOf(await quote("mint"));
    expect(q).toMatchObject({ amount: { value: 1, unit: "cc" }, priceKrw: 150000, vatIncluded: true, indicative: true });
    expect(q.event).toBeUndefined();
    expect(q.offerApplied).toBeUndefined();
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("a proof the verifier refuses gives the regular price, not a rejection", async () => {
    verifyMock.mockResolvedValue({ ok: false, reason: "commitment mismatch" });
    const task = await quote("mint", { metadata: { offerProof: offerProof("ofr_mint_rejuran_first_visit", "cln_mint") } });
    expect(task.status.state).toBe("TASK_STATE_COMPLETED");
    expect(quoteOf(task)).toMatchObject({ priceKrw: 150000 });
    expect(quoteOf(task).offerApplied).toBeUndefined();
  });

  it("a verifier that cannot be reached gives the regular price", async () => {
    verifyMock.mockRejectedValue(new Error("ZK server POST /api/zk/verify-offer failed: ECONNREFUSED"));
    const task = await quote("mint", { metadata: { offerProof: offerProof("ofr_mint_rejuran_first_visit", "cln_mint") } });
    expect(task.status.state).toBe("TASK_STATE_COMPLETED");
    expect(quoteOf(task)).toMatchObject({ priceKrw: 150000 });
    expect(quoteOf(task).event).toBeUndefined();
  });

  it("an unanchored pseudonym passes the first visit offer but not a second visit offer", async () => {
    verifyMock.mockResolvedValue({ ok: true, reason: "빈 차트로 간주", unanchored: true });
    const mint = await quote("mint", { metadata: { offerProof: offerProof("ofr_mint_rejuran_first_visit", "cln_mint", { unanchored: true }) } });
    expect(quoteOf(mint)).toMatchObject({ priceKrw: 99000, offerApplied: { offerId: "ofr_mint_rejuran_first_visit" } });
    expect(verifyMock.mock.calls[0]![1]).toMatchObject({ unanchored: true });

    const glow = await quote("seoul-glow", { metadata: { offerProof: offerProof("ofr_seoul_glow_rejuran_second", "cln_seoul_glow") } });
    expect(quoteOf(glow)).toMatchObject({ priceKrw: 340000 });
    expect(quoteOf(glow).offerApplied).toBeUndefined();
  });

  it("a proof for another clinic's offer is not sent to the verifier", async () => {
    const task = await quote("mint", { metadata: { offerProof: offerProof("ofr_seoul_glow_rejuran_second", "cln_seoul_glow") } });
    expect(quoteOf(task)).toMatchObject({ priceKrw: 150000 });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("Seoul Glow 2cc without a proof: 340,000 VAT included, firm price, the second visit package stays off", async () => {
    const q = quoteOf(await quote("seoul-glow"));
    expect(q).toMatchObject({
      clinicId: "cln_seoul_glow",
      product: "Rejuran Healer",
      amount: { value: 2, unit: "cc" },
      priceKrw: 340000,
      vatIncluded: true,
      indicative: false,
      operationMode: "clinic",
      includes: ["마취크림", "진정팩"],
      languages: ["ja"],
    });
    expect(q.event).toBeUndefined();
    expect(q.slots).toHaveLength(12);
  });

  it("Seoul Glow with a verified second visit proof: the 306,000 package with offerApplied", async () => {
    verifyMock.mockResolvedValue({ ok: true, reason: "verified" });
    const q = quoteOf(await quote("seoul-glow", { metadata: { offerProof: offerProof("ofr_seoul_glow_rejuran_second", "cln_seoul_glow") } }));
    expect(q).toMatchObject({ priceKrw: 306000, amount: { value: 2, unit: "cc" }, offerApplied: { offerId: "ofr_seoul_glow_rejuran_second", verified: true } });
    expect(q.event).toMatchObject({ regularPriceKrw: 340000, zkClauses: [{ type: "rejuran_healer", minCount: 1, maxCount: 1 }] });
  });

  it("Ara 2cc: 300,000 VAT excluded, indicative. Hanbit 2cc: 420,000", async () => {
    expect(quoteOf(await quote("ara"))).toMatchObject({ priceKrw: 300000, vatIncluded: false, indicative: true, operationMode: "proxy" });
    expect(quoteOf(await quote("hanbit"))).toMatchObject({ priceKrw: 420000, vatIncluded: true, indicative: true });
  });

  it("rejects a procedure the clinic has neither on the menu nor as an event", async () => {
    const task = await quote("mint", { data: procedureRequest({ procedureId: "ulthera", amount: { value: 300, unit: "shot" } }) });
    expect(task.status.state).toBe("TASK_STATE_REJECTED");
    expect(statusText(task)).toBe("procedure_not_offered");
  });
});

describe("referral tokens (03 referral extension)", () => {
  it("rejects a quote without a token", async () => {
    const task = await call("seoul-glow", "clinic.quote", procedureRequest());
    expect(task.status.state).toBe("TASK_STATE_REJECTED");
    expect(statusText(task)).toBe("referral_token_missing");
  });

  it("rejects an expired token (72 hours)", async () => {
    const token = await referral("cln_seoul_glow");
    setClock("2026-11-15T11:00:00+09:00");
    const task = await call("seoul-glow", "clinic.quote", procedureRequest(), { referralToken: token });
    expect(task.status.state).toBe("TASK_STATE_REJECTED");
    expect(statusText(task)).toBe("referral_token_expired");
  });

  it("rejects a token issued for another clinic", async () => {
    const task = await call("seoul-glow", "clinic.quote", procedureRequest(), { referralToken: await referral("cln_mint") });
    expect(task.status.state).toBe("TASK_STATE_REJECTED");
    expect(statusText(task)).toBe("referral_token_wrong_audience");
  });

  it("rejects a booking without a token", async () => {
    const q = quoteOf(await quote("seoul-glow"));
    const task = await call("seoul-glow", "clinic.book", bookingRequest(q, "2026-11-14T11:00:00+09:00"));
    expect(task.status.state).toBe("TASK_STATE_REJECTED");
    expect(statusText(task)).toBe("referral_token_missing");
  });
});

describe("clinic.book: WORKING, confirmation and the report to the platform", () => {
  it("direct clinic: WORKING at once, the clinic confirms, GetTask sees COMPLETED with pibu/booking@1", async () => {
    const slot = "2026-11-14T11:00:00+09:00";
    const { q, task } = await quoteAndBook("seoul-glow", slot);
    expect(task.status.state).toBe("TASK_STATE_WORKING");
    const pending = await bookingFor(task.id);
    expect(pending).toMatchObject({ clinicId: "cln_seoul_glow", status: "pending_clinic", customerAgentId: yuki.agentId, priceKrw: 340000 });
    expect(pending.id).toMatch(/^bkg_/);
    expect(pending.referralJti).toBeTruthy();
    expect((await getSlot("slot_seoul_glow_20261114_1100"))?.held).toBe(true);
    expect((await listInbox("cln_seoul_glow")).map((b) => b.id)).toEqual([pending.id]);
    expect(await listProxyQueue()).toEqual([]);
    expect(await reportCalls()).toHaveLength(0);

    await expect(confirmProxyBooking(pending.id, { fetchImpl: routeFetch })).rejects.toThrow(/confirmClinicBooking/);
    const confirmed = await confirmClinicBooking(pending.id, { fetchImpl: routeFetch });
    expect(confirmed).toMatchObject({ status: "confirmed", confirmedBy: "clinic_staff" });

    const polled = await getTask({ from: yuki, toCardUrl: cardOf("seoul-glow"), taskId: task.id, fetchImpl: routeFetch });
    expect(polled.status.state).toBe("TASK_STATE_COMPLETED");
    const booking = BookingV1Schema.parse(taskArtifactData(polled));
    expect(booking).toMatchObject({
      bookingId: pending.id,
      quoteId: q.quoteId,
      clinicId: "cln_seoul_glow",
      customerAgentId: yuki.agentId,
      slot,
      status: "confirmed",
      confirmedBy: "clinic_staff",
      priceKrw: 340000,
    });
    expect(Object.keys(booking.instructions ?? {}).sort()).toEqual(["ja", "ko"]);
    expect(polled.artifacts?.[0]?.artifactId).toBeTruthy();

    const reports = await reportCalls();
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ from: { agentId: "cln_seoul_glow", role: "clinic" }, to: { role: "platform" }, contextId: "req_01J9Z8" });
    await expect(confirmClinicBooking(pending.id, { fetchImpl: routeFetch })).rejects.toThrow(/not pending_clinic/);
  });

  it("proxy clinic: the booking waits in the proxy queue until the operator confirms", async () => {
    const { task } = await quoteAndBook("mint", "2026-11-14T15:00:00+09:00");
    expect(task.status.state).toBe("TASK_STATE_WORKING");
    expect(statusText(task)).toContain("Pibu is checking with the clinic");
    const pending = await bookingFor(task.id);
    expect((await listProxyQueue()).map((b) => b.id)).toEqual([pending.id]);

    await expect(confirmClinicBooking(pending.id, { fetchImpl: routeFetch })).rejects.toThrow(/confirmProxyBooking/);
    await confirmProxyBooking(pending.id, { fetchImpl: routeFetch });

    const polled = await getTask({ from: yuki, toCardUrl: cardOf("mint"), taskId: task.id, fetchImpl: routeFetch });
    expect(polled.status.state).toBe("TASK_STATE_COMPLETED");
    expect(BookingV1Schema.parse(taskArtifactData(polled))).toMatchObject({ status: "confirmed", confirmedBy: "pibu_operator", priceKrw: 150000 });
    expect(await listProxyQueue()).toEqual([]);
    expect(await reportCalls()).toHaveLength(1);
  });

  it("autoConfirm clinic (Dahye): COMPLETED in the same call and reported once", async () => {
    const { task } = await quoteAndBook(
      "dahye",
      "2026-11-14T10:00:00+09:00",
      { guest: { displayName: "Emily R.", contactChannel: "email", contactHandle: "emily@example.com", language: "en" } },
      procedureRequest({ languages: ["en"], visitorProfile: { nationality: "US" } }),
    );
    expect(task.status.state).toBe("TASK_STATE_COMPLETED");
    const booking = BookingV1Schema.parse(taskArtifactData(task));
    expect(booking).toMatchObject({ status: "confirmed", confirmedBy: "auto", priceKrw: 360000 });
    expect(booking.instructions).toEqual({
      en: expect.any(String),
      ko: expect.any(String),
    });
    expect((await bookingFor(task.id)).status).toBe("confirmed");
    expect(await reportCalls()).toHaveLength(1);
  });

  it("confirms even when the platform cannot be reached", async () => {
    const { task } = await quoteAndBook("seoul-glow", "2026-11-14T11:00:00+09:00");
    const pending = await bookingFor(task.id);
    const down: typeof fetch = async (input, init) => {
      const req = new Request(input, init);
      if (new URL(req.url).pathname.startsWith("/a2a/platform/")) throw new TypeError("fetch failed");
      return routeFetch(req);
    };
    await expect(confirmClinicBooking(pending.id, { fetchImpl: down })).resolves.toMatchObject({ status: "confirmed" });
    const polled = await getTask({ from: yuki, toCardUrl: cardOf("seoul-glow"), taskId: task.id, fetchImpl: routeFetch });
    expect(polled.status.state).toBe("TASK_STATE_COMPLETED");
  });

  it("rejects an unknown quote and a slot that is already held", async () => {
    const q = quoteOf(await quote("seoul-glow"));
    const token = await referral("cln_seoul_glow");
    const unknown = await call("seoul-glow", "clinic.book", bookingRequest({ ...q, quoteId: "qt_nope" }, "2026-11-14T11:00:00+09:00"), { referralToken: token });
    expect(statusText(unknown)).toBe("quote_not_found");

    const first = await call("seoul-glow", "clinic.book", bookingRequest(q, "2026-11-14T11:00:00+09:00"), { referralToken: token });
    expect(first.status.state).toBe("TASK_STATE_WORKING");
    const second = await call("seoul-glow", "clinic.book", bookingRequest(q, "2026-11-14T11:00:00+09:00"), { referralToken: token });
    expect(second.status.state).toBe("TASK_STATE_REJECTED");
    expect(statusText(second)).toBe("slot_unavailable");
  });

  it("rejectBooking ends the customer's task REJECTED and frees the slot", async () => {
    const { task } = await quoteAndBook("seoul-glow", "2026-11-14T11:00:00+09:00");
    const pending = await bookingFor(task.id);
    const declined = await rejectBooking(pending.id, "doctor unavailable");
    expect(declined.status).toBe("canceled");
    const polled = await getTask({ from: yuki, toCardUrl: cardOf("seoul-glow"), taskId: task.id, fetchImpl: routeFetch });
    expect(polled.status.state).toBe("TASK_STATE_REJECTED");
    expect(statusText(polled)).toBe("booking_rejected: doctor unavailable");
    expect((await getSlot("slot_seoul_glow_20261114_1100"))?.held).toBe(false);
    expect(await reportCalls()).toHaveLength(0);
  });
});

describe("clinic.book: the one input request of P0", () => {
  it("asks for the passport name and last Rejuran date when safety info is missing, then continues on the answer", async () => {
    const q = quoteOf(await quote("mint"));
    const request = bookingRequest(q, "2026-11-14T11:00:00+09:00");
    delete (request as { safetyInfo?: unknown }).safetyInfo;
    const asked = await call("mint", "clinic.book", request, { referralToken: await referral("cln_mint") });
    expect(asked.status.state).toBe("TASK_STATE_INPUT_REQUIRED");
    const dataPart = asked.status.message?.parts.find((p) => "data" in p) as { data: unknown } | undefined;
    const inputRequest = InputRequestV1Schema.parse(dataPart?.data);
    expect(inputRequest.fields.map((f) => f.key)).toEqual(["passportName", "lastRejuranDate"]);
    expect(inputRequest.fields[0]).toMatchObject({ sensitive: true, label: { ja: "パスポート記載の氏名" } });
    expect(await listProxyQueue()).toEqual([]);

    const answered = await call(
      "mint",
      "clinic.book",
      { schema: "pibu/input-response@1", values: { passportName: "TANAKA YUKI", lastRejuranDate: "2026-08-10" } },
      {},
      asked.id,
    );
    expect(answered.id).toBe(asked.id);
    expect(answered.status.state).toBe("TASK_STATE_WORKING");
    const record = await bookingFor(asked.id);
    expect(record.inputValues).toEqual({ passportName: "TANAKA YUKI", lastRejuranDate: "2026-08-10" });
    expect(record.inputRequested).toBeUndefined();
    expect(record.status).toBe("pending_clinic");
    // Only now is it the operator's turn.
    expect((await listProxyQueue()).map((b) => b.id)).toEqual([record.id]);
  });
});

describe("clinic.cancel", () => {
  it("cancels the caller's booking, frees the slot and ends the waiting book task", async () => {
    const { task } = await quoteAndBook("seoul-glow", "2026-11-14T11:00:00+09:00");
    const pending = await bookingFor(task.id);
    const canceled = await call("seoul-glow", "clinic.cancel", { schema: "pibu/cancel-request@1", bookingId: pending.id, reason: "flight changed" });
    expect(canceled.status.state).toBe("TASK_STATE_COMPLETED");
    expect(BookingV1Schema.parse(taskArtifactData(canceled))).toMatchObject({ bookingId: pending.id, status: "canceled" });
    expect((await getSlot("slot_seoul_glow_20261114_1100"))?.held).toBe(false);
    const polled = await getTask({ from: yuki, toCardUrl: cardOf("seoul-glow"), taskId: task.id, fetchImpl: routeFetch });
    expect(polled.status.state).toBe("TASK_STATE_CANCELED");
  });

  it("rejects an unknown booking and another customer's booking", async () => {
    const task = await call("mint", "clinic.cancel", { schema: "pibu/cancel-request@1", bookingId: "bkg_nope", reason: "x" });
    expect(task.status.state).toBe("TASK_STATE_REJECTED");
    expect(statusText(task)).toBe("booking_not_found");

    const { task: booked } = await quoteAndBook("seoul-glow", "2026-11-14T11:00:00+09:00");
    const pending = await bookingFor(booked.id);
    const other = await sendMessage({
      from: { agentId: "cag_2m8x9", role: "customer" },
      toCardUrl: cardOf("seoul-glow"),
      skillId: "clinic.cancel",
      data: { schema: "pibu/cancel-request@1", bookingId: pending.id, reason: "x" },
      contextId: "req_other",
      fetchImpl: routeFetch,
    });
    expect(statusText(other)).toBe("booking_not_found");
    expect((await bookingFor(booked.id)).status).toBe("pending_clinic");
  });
});

describe("clinic.offers and clinic.availability", () => {
  it("Mint: the regular menu plus the first visit 1cc event, the only Rejuran item", async () => {
    const task = await call("mint", "clinic.offers", { schema: "pibu/offers-query@1" });
    const offers = taskArtifactData(task) as { month: string; items: Array<Record<string, any>> };
    expect(offers.month).toBe("2026-11");
    const events = offers.items.filter((i) => i.event);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      procedureId: "rejuran_healer",
      amount: { value: 1, unit: "cc" },
      priceKrw: 99000,
      vatIncluded: true,
      event: { regularPriceKrw: 150000, conditions: "첫 방문 한정", zkClauses: [{ clinicId: "cln_mint", maxCount: 0 }] },
    });
    expect(offers.items.filter((i) => i.procedureId === "rejuran_healer")).toHaveLength(1);
    expect(offers.items).toHaveLength(4);
  });

  it("Seoul Glow: four menu items and the second visit package; no events in a month without any", async () => {
    const task = await call("seoul-glow", "clinic.offers", { schema: "pibu/offers-query@1" });
    const offers = taskArtifactData(task) as { items: Array<Record<string, any>> };
    expect(offers.items.filter((i) => !i.event)).toHaveLength(4);
    expect(offers.items.filter((i) => i.event)).toEqual([
      expect.objectContaining({ product: "Rejuran Healer", priceKrw: 306000, event: expect.objectContaining({ title: "리쥬란 2회차 패키지" }) }),
    ]);

    const december = await call("seoul-glow", "clinic.offers", { schema: "pibu/offers-query@1", month: "2026-12" });
    const later = taskArtifactData(december) as { month: string; items: Array<Record<string, any>> };
    expect(later.month).toBe("2026-12");
    expect(later.items.filter((i) => i.event)).toHaveLength(0);
  });

  it("Seoul Glow has 12 open Rejuran slots from 11/13 to 11/15; a proxy clinic's slots are indicative", async () => {
    const query = { schema: "pibu/availability-query@1", procedureId: "rejuran_healer", from: "2026-11-13", to: "2026-11-15" };
    const glow = taskArtifactData(await call("seoul-glow", "clinic.availability", query)) as { slots: string[]; indicative: boolean };
    expect(glow.slots).toHaveLength(12);
    expect(glow.slots[0]).toBe("2026-11-13T10:00:00+09:00");
    expect(glow.indicative).toBe(false);
    const mint = taskArtifactData(await call("mint", "clinic.availability", query)) as { indicative: boolean };
    expect(mint.indicative).toBe(true);

    await quoteAndBook("seoul-glow", "2026-11-14T11:00:00+09:00");
    const after = taskArtifactData(await call("seoul-glow", "clinic.availability", query)) as { slots: string[] };
    expect(after.slots).toHaveLength(11);
    expect(after.slots).not.toContain("2026-11-14T11:00:00+09:00");
  });
});

describe("information boundary (02)", () => {
  it.each([
    ["notes", { notes: "flying home on 11-15" }],
    ["ageBand", { visitorProfile: { nationality: "JP", ageBand: "25-29" } }],
    ["residency", { visitorProfile: { nationality: "JP", residency: "short_term_visitor" } }],
  ])("the server refuses a clinic quote request carrying %s with -32602", async (_field, extra) => {
    const error = await quote("seoul-glow", { data: procedureRequest(extra) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(A2AClientError);
    expect(error).toMatchObject({ kind: "rpc", code: -32602 });
  });
});
