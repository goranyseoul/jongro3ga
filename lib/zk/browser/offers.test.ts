import { describe, expect, it } from "vitest";
import { createWallet } from "./wallet";
import { fromCodedClause, matchesOffer, parsePublicOffers } from "./offers";

// Shape of GET /api/offers (glowpass/catalog.mjs OFFERS + clinic + conditions), trimmed to two offers.
const payload = [
  {
    id: "ofr_mint_rejuran_first_visit",
    clinicId: "cln_mint",
    procedureId: "rejuran_healer",
    title: "첫 방문 1cc 이벤트",
    benefit: "리쥬란 1cc 99,000원 (정상가 150,000원)",
    clauses: [{ clinic: 2, maxCount: 0 }],
    clinic: "민트피부과의원",
    conditions: ["시술 무관 @ 민트피부과의원 기록 0건"],
  },
  {
    id: "ofr_seoul_glow_rejuran_second",
    clinicId: "cln_seoul_glow",
    title: "리쥬란 2회차 패키지 10%",
    benefit: "2회차·3회차 묶음 10% 할인",
    clauses: [{ type: 1, minCount: 1, maxCount: 1 }],
    clinic: "서울글로우의원",
    conditions: ["리쥬란 힐러 정확히 1회"],
  },
  { id: "ofr_unknown", clinicId: "cln_x", clauses: [{ clinic: 99, maxCount: 0 }] },
  "not an offer",
];

describe("public offers", () => {
  it("maps circuit codes back to wire ids", () => {
    expect(fromCodedClause({ clinic: 2, maxCount: 0 })).toEqual({ clinicId: "cln_mint", maxCount: 0 });
    expect(fromCodedClause({ type: 1, clinic: 3, minCount: 1, maxCount: 1 })).toEqual({
      type: "rejuran_healer",
      clinicId: "cln_hanbit",
      minCount: 1,
      maxCount: 1,
    });
    expect(fromCodedClause({ type: 0, clinic: 0, minCount: 3 })).toEqual({ minCount: 3 });
  });

  it("parses the server payload and drops offers it cannot evaluate", () => {
    const offers = parsePublicOffers(payload);
    expect(offers.map((offer) => offer.id)).toEqual(["ofr_mint_rejuran_first_visit", "ofr_seoul_glow_rejuran_second"]);
    expect(offers[0]).toMatchObject({ clinic: "민트피부과의원", clauses: [{ clinicId: "cln_mint", maxCount: 0 }] });
    expect(() => parsePublicOffers({})).toThrow();
  });

  it("matches a never-anchored empty chart to first-visit offers only", () => {
    const { chart } = createWallet();
    const [firstVisit, secondSession] = parsePublicOffers(payload);
    expect(matchesOffer(chart, 29880322, firstVisit)).toBe(true);
    expect(matchesOffer(chart, 29880322, secondSession)).toBe(false);
  });
});
