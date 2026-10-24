import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { routeFetch } from "../../a2a/__fixtures__/route-fetch";
import { sendMessage } from "../../a2a/client";
import { EXT } from "../../a2a/cards";
import type { OffersV1 } from "../../a2a/schemas";
import { taskArtifactData } from "../../a2a/wire";
import { clock } from "../../clock";
import type { TreatmentRecord } from "../../domain";
import { clinicCode, procedureCode } from "../../zk/codes";
import { proveOffer, verifyOffer } from "../../zk/client";
import { getRequestView, runRequest } from "./orchestrator";
import { customerStore } from "./store";
import { buildChart, chainToday, offerIdFor, parseOffers, planOffers, zkOfferItems } from "./zk-match";
import { BASE, CATALOG, LIN, YUKI, bundleFor, catalog, draftLin, draftYuki, logOf, setupCustomerTest, teardownCustomerTest } from "./__fixtures__/setup";

// T18 customer side (INTEGRATION 3 and 4): device side offer matching, proofs only for offers that hold, and no
// proof request and no proof for a clinic whose offer does not hold.

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

const TODAY_DATE = "2026-11-12";

/** Every clinic's pibu/offers@1 for November, over the real clinic.offers route. */
async function allOffers(): Promise<Map<string, OffersV1>> {
  const out = new Map<string, OffersV1>();
  for (const slug of ["seoul-glow", "mint", "ara", "hanbit", "dahye"]) {
    const task = await sendMessage({
      from: { agentId: YUKI.agentId, role: "customer" },
      toCardUrl: `${BASE}/a2a/clinics/${slug}/agent-card.json`,
      skillId: "clinic.offers",
      data: { schema: "pibu/offers-query@1", month: "2026-11" },
      contextId: "req_offers_t",
      fetchImpl: routeFetch,
    });
    const offers = parseOffers(taskArtifactData(task))!;
    out.set(offers.clinicId, offers);
  }
  return out;
}

const eligibleClinics = (records: TreatmentRecord[], offers: Map<string, OffersV1>) => {
  const today = chainToday(clock.now());
  return planOffers({ chart: buildChart(records, today, TODAY_DATE), today, todayDate: TODAY_DATE, procedureId: "rejuran_healer", offersByClinic: offers })
    .filter((p) => p.eligible.length > 0)
    .map((p) => p.clinicId)
    .sort();
};

type Wire = { params: { message: { metadata?: Record<string, unknown>; extensions?: string[] } } };
const quoteMessages = async (requestId: string) =>
  (await logOf(requestId))
    .filter((e) => e.skillId === "clinic.quote")
    .map((e) => ({ clinicId: e.to.agentId, message: (e.request as Wire).params.message }));

describe("the chart and the clauses, on the device", () => {
  it("builds the chart from clinic confirmed records only: codes, chain days, 8 slots", async () => {
    const today = chainToday(clock.now());
    const lin = await customerStore.records(LIN.customerId);
    const manual: TreatmentRecord = { ...lin[0]!, id: "rec_manual", source: "manual", clinicId: "cln_mint" };
    const chart = buildChart([...lin, manual], today, TODAY_DATE);
    expect(chart.types).toEqual([procedureCode("rejuran_healer"), 0, 0, 0, 0, 0, 0, 0]);
    expect(chart.clinics).toEqual([clinicCode("cln_hanbit"), 0, 0, 0, 0, 0, 0, 0]);
    // 2026-09-17 is 56 days before 2026-11-12: a calendar day is one chain day.
    expect(chart.dates[0]).toBe(today - 56);
    expect(chart.salt).toBe("0");
  });

  it("Yuki (no records): only Mint's first visit offer holds", async () => {
    expect(eligibleClinics(await customerStore.records(YUKI.customerId), await allOffers())).toEqual(["cln_mint"]);
  });

  it("Lin (Rejuran once at Hanbit, booking): Seoul Glow 2nd session, Hanbit continue and Mint first visit hold", async () => {
    const offers = await allOffers();
    expect(eligibleClinics(await customerStore.records(LIN.customerId), offers)).toEqual(["cln_hanbit", "cln_mint", "cln_seoul_glow"]);
  });

  it("a manual record proves nothing: Lin with the same visit typed in by hand is a first timer", async () => {
    const manual = (await customerStore.records(LIN.customerId)).map((r) => ({ ...r, source: "manual" as const }));
    expect(eligibleClinics(manual, await allOffers())).toEqual(["cln_mint"]);
  });

  it("finds the offer id in the wallet catalog by clinic and identical clauses", async () => {
    const hanbit = zkOfferItems((await allOffers()).get("cln_hanbit")!, "rejuran_healer", TODAY_DATE);
    expect(hanbit).toHaveLength(1);
    expect(offerIdFor(hanbit[0]!, CATALOG)).toBe("ofr_hanbit_rejuran_continue");
    expect(offerIdFor(hanbit[0]!, CATALOG.filter((o) => o.id !== "ofr_hanbit_rejuran_continue"))).toBeUndefined();
  });
});

describe("proofs in the quote flow", () => {
  it("Yuki: proves only Mint's offer and sends no proof and no zk extension to Seoul Glow and Ara", async () => {
    const draft = await draftYuki();
    await runRequest(draft.id, { fetchImpl: routeFetch, offerCatalog: catalog });
    expect(vi.mocked(proveOffer).mock.calls).toEqual([["cus_yuki", "ofr_mint_rejuran_first_visit"]]);

    const messages = await quoteMessages(draft.id);
    expect(messages.map((m) => m.clinicId).sort()).toEqual(["cln_ara", "cln_mint", "cln_seoul_glow"]);
    for (const { clinicId, message } of messages) {
      if (clinicId === "cln_mint") {
        expect(message.metadata?.offerProof).toMatchObject({ schema: "pibu/offer-proof@1", offerId: "ofr_mint_rejuran_first_visit", clinicId: "cln_mint", unanchored: true });
        expect(message.extensions).toContain(EXT.zkOfferProof);
      } else {
        expect(message.metadata).not.toHaveProperty("offerProof");
        expect(message.extensions).not.toContain(EXT.zkOfferProof);
      }
    }
    const steps = (await customerStore.request(draft.id))!.steps;
    expect(steps.filter((s) => s.kind === "proof_attached").map((s) => s.clinicId)).toEqual(["cln_mint"]);
    expect(steps.filter((s) => s.kind === "offer_match").map((s) => s.clinicId)).toEqual(["cln_seoul_glow", "cln_mint"]);
  });

  it("Lin: proves Hanbit's continue offer and Hanbit applies the event price", async () => {
    const draft = await draftLin();
    const done = await runRequest(draft.id, { fetchImpl: routeFetch, offerCatalog: catalog });
    expect(done.status).toBe("comparing");
    expect(done.shortlist?.candidates.map((c) => c.clinicId)).toEqual(["cln_hanbit"]);
    expect(vi.mocked(proveOffer).mock.calls).toEqual([["cus_lin", "ofr_hanbit_rejuran_continue"]]);
    const [quote] = (await getRequestView(draft.id))!.quotes;
    expect(quote!.quote).toMatchObject({ clinicId: "cln_hanbit", priceKrw: 378_000, offerApplied: { offerId: "ofr_hanbit_rejuran_continue", verified: true } });
    // The history itself never travels: the quote message has the proof, no record fields.
    const [message] = await quoteMessages(draft.id);
    expect(JSON.stringify(message!.message)).not.toContain("2026-09-17");
  });

  it("goes on without a proof (regular price, not a failure) when the wallet cannot prove", async () => {
    vi.mocked(proveOffer).mockRejectedValue(new Error("ZK server POST /api/zk/prove-offer failed (500): Cannot satisfy constraint"));
    const draft = await draftYuki();
    const done = await runRequest(draft.id, { fetchImpl: routeFetch, offerCatalog: catalog });
    expect(done.status).toBe("comparing");
    const mint = (await getRequestView(draft.id))!.quotes.find((q) => q.quote.clinicId === "cln_mint")!;
    expect(mint.quote.offerApplied).toBeUndefined();
    expect(mint.quote.priceKrw).toBe(150_000);
    for (const { message } of await quoteMessages(draft.id)) expect(message.metadata).not.toHaveProperty("offerProof");
    expect(done.steps.filter((s) => s.kind === "proof_skipped").map((s) => s.clinicId)).toEqual(["cln_mint"]);
    expect(verifyOffer).not.toHaveBeenCalled();
  });

  it("asks for no proof when the catalog has no id for the offer", async () => {
    const draft = await draftYuki();
    await runRequest(draft.id, { fetchImpl: routeFetch, offerCatalog: async () => [] });
    expect(proveOffer).not.toHaveBeenCalled();
  });
});
