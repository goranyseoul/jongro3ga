import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Offer } from "../../domain";
import { verifyOffer } from "../../zk/client";
import { checkOfferProof } from "./offer-proof";
import { closestByAmount, eventActiveInMonth, eventProduct } from "./offers";
import { addDays } from "./quote";

// Pure pieces of clinic.quote and clinic.offers that the route tests only reach indirectly.

vi.mock("../../zk/client", () => ({ verifyOffer: vi.fn() }));
const verifyMock = vi.mocked(verifyOffer);

const mintFirstVisit: Offer = {
  id: "ofr_mint_rejuran_first_visit",
  clinicId: "cln_mint",
  procedureId: "rejuran_healer",
  title: "첫 방문 1cc 이벤트",
  amount: { value: 1, unit: "cc" },
  priceKrw: 99000,
  regularPriceKrw: 150000,
  validFrom: "2026-11-01",
  validUntil: "2026-11-30",
  conditions: "첫 방문 한정",
  zkClauses: [{ clinicId: "cln_mint", maxCount: 0 }],
};

const proof = (extra: Record<string, unknown> = {}) => ({
  schema: "pibu/offer-proof@1",
  offerId: "ofr_mint_rejuran_first_visit",
  clinicId: "cln_mint",
  subjectId: `0x${"ab".repeat(32)}`,
  chainId: 84532,
  registry: `0x${"cd".repeat(20)}`,
  today: 29880272,
  proofs: [{ proof: "0x1f", publicInputs: ["0x0b"] }],
  ...extra,
});

const check = (raw: unknown, overrides: Partial<Parameters<typeof checkOfferProof>[0]> = {}) =>
  checkOfferProof({ clinicId: "cln_mint", procedureId: "rejuran_healer", offers: [mintFirstVisit], today: "2026-11-12", raw, ...overrides });

beforeEach(() => {
  verifyMock.mockReset();
  verifyMock.mockResolvedValue({ ok: true, reason: "verified" });
});

describe("closestByAmount (07 견적 규칙 2)", () => {
  const items = [1, 2, 3].map((value) => ({ amount: { value, unit: "cc" as const } }));

  it("picks the closest amount and breaks ties toward the larger one", () => {
    expect(closestByAmount(items, { value: 2, unit: "cc" })?.amount.value).toBe(2);
    expect(closestByAmount(items, { value: 2.5, unit: "cc" })?.amount.value).toBe(3);
    expect(closestByAmount([items[0]!, items[2]!], { value: 2, unit: "cc" })?.amount.value).toBe(3);
  });

  it("prefers the asked unit", () => {
    const mixed = [{ amount: { value: 2, unit: "vial" as const } }, { amount: { value: 5, unit: "cc" as const } }];
    expect(closestByAmount(mixed, { value: 2, unit: "cc" })?.amount.unit).toBe("cc");
  });
});

describe("offer helpers", () => {
  it("an event belongs to a month when its period overlaps it", () => {
    expect(eventActiveInMonth(mintFirstVisit, "2026-11")).toBe(true);
    expect(eventActiveInMonth({ validFrom: "2026-10-25", validUntil: "2026-11-02" }, "2026-10")).toBe(true);
    expect(eventActiveInMonth(mintFirstVisit, "2026-12")).toBe(false);
    expect(eventActiveInMonth(mintFirstVisit, "2026-10")).toBe(false);
  });

  it("names an event's product from the clinic menu, then the procedure master", () => {
    expect(eventProduct("rejuran_healer", [])).toBe("Rejuran");
    const menu = [{ id: "m", clinicId: "c", procedureId: "rejuran_healer", product: "Rejuran Healer", amount: { value: 2, unit: "cc" as const }, priceKrw: 1, vatIncluded: true, includes: [], foreignerSamePrice: true }];
    expect(eventProduct("rejuran_healer", menu)).toBe("Rejuran Healer");
  });

  it("adds calendar days across a month end", () => {
    expect(addDays("2026-11-28", 7)).toBe("2026-12-05");
  });
});

describe("checkOfferProof", () => {
  it("verifies a proof for the clinic's active proof-only event", async () => {
    expect(await check(proof())).toEqual({ verified: true, offerId: "ofr_mint_rejuran_first_visit", unanchored: false });
    expect(verifyMock).toHaveBeenCalledWith("cln_mint", {
      subjectId: `0x${"ab".repeat(32)}`,
      offerId: "ofr_mint_rejuran_first_visit",
      today: 29880272,
      proofs: [{ proof: "0x1f", publicInputs: ["0x0b"] }],
    });
  });

  it("does not ask the verifier about a proof that cannot apply here", async () => {
    expect(await check(undefined)).toMatchObject({ verified: false, reason: "no_proof" });
    expect(await check(proof({ chainId: "x" }))).toMatchObject({ verified: false, reason: "malformed" });
    expect(await check(proof({ clinicId: "cln_seoul_glow" }))).toMatchObject({ verified: false, reason: "other_clinic" });
    expect(await check(proof({ offerId: "ofr_seoul_glow_rejuran_second" }))).toMatchObject({ verified: false, reason: "no_such_offer" });
    expect(await check(proof(), { procedureId: "shrink_universe" })).toMatchObject({ verified: false, reason: "no_such_offer" });
    expect(await check(proof(), { today: "2026-12-01" })).toMatchObject({ verified: false, reason: "no_such_offer" });
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it("maps verifier answers: refused, unreachable, unanchored", async () => {
    verifyMock.mockResolvedValueOnce({ ok: false, reason: "bad proof" });
    expect(await check(proof())).toMatchObject({ verified: false, reason: "rejected" });
    verifyMock.mockRejectedValueOnce(new Error("down"));
    expect(await check(proof())).toMatchObject({ verified: false, reason: "verifier_unreachable" });
    verifyMock.mockResolvedValueOnce({ ok: true, reason: "빈 차트로 간주", unanchored: true });
    expect(await check(proof({ unanchored: true }))).toEqual({ verified: true, offerId: "ofr_mint_rejuran_first_visit", unanchored: true });

    const second: Offer = { ...mintFirstVisit, id: "ofr_mint_second", zkClauses: [{ type: "rejuran_healer", minCount: 1, maxCount: 1 }] };
    verifyMock.mockResolvedValueOnce({ ok: true, reason: "빈 차트로 간주", unanchored: true });
    expect(await check(proof({ offerId: "ofr_mint_second" }), { offers: [second] })).toMatchObject({ verified: false, reason: "needs_records" });
  });
});
