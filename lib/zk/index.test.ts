import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  ZK_OFFER_PROOF_METADATA_KEY,
  ledgerSummary,
  matchOffers,
  matchOffersDetailed,
  proveOffer,
  publicOffers,
  readOfferProof,
  verifyOffer,
  zkEnabled,
  type ZkOfferProofBundle,
} from "./bridge";
import { CLINIC_TABLE, PERSONA_TABLE, fromGlowpassClinic, toGlowpassClinic, toGlowpassPersona } from "./identity";

// A fake GlowPass: same paths and answer shapes as glowpass/server.mjs, recorded requests, switchable delay.
type Seen = { method: string; path: string; body: unknown; clientId: string | undefined };
const seen: Seen[] = [];
let delayMs = 0;

const BUNDLE: ZkOfferProofBundle = {
  subjectId: "0x5c0d",
  offerId: "ofr_mint_rejuran_first_visit",
  today: 29880272,
  proofs: [{ proof: "0xabcd", publicInputs: ["0x01", "29880272", "0", "2", "0", "100000", "0", "0"] }],
};

const MATCH = [
  { offerId: "ofr_mint_rejuran_first_visit", clinicId: "cln_mint", procedureId: "rejuran_healer", clinic: "민트피부과의원", title: "첫 방문 1cc 이벤트", benefit: "리쥬란 1cc 99,000원", scene: 1, conditions: ["시술 무관 @ 민트피부과의원 기록 0건"], eligible: true },
  { offerId: "ofr_seoul_glow_rejuran_second", clinicId: "cln_seoul_glow", clinic: "서울글로우의원", title: "리쥬란 2회차 패키지 10%", benefit: "10%", scene: 2, conditions: ["리쥬란 힐러 정확히 1회"], eligible: false },
  { offerId: "ofr_elsewhere", clinicId: "cln_not_in_pibook", clinic: "X", title: "X", benefit: "X", scene: 1, conditions: [], eligible: true },
];

async function readJson(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : undefined;
}

function reply(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

let server: Server;
let url = "";

beforeAll(async () => {
  server = createServer(async (req, res) => {
    const body = await readJson(req);
    seen.push({ method: req.method ?? "", path: req.url ?? "", body, clientId: req.headers["x-client-id"] as string | undefined });
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    if (res.destroyed) return;
    const b = body as Record<string, unknown> | undefined;
    if (req.url === "/api/zk/match-offers") return reply(res, 200, MATCH);
    if (req.url === "/api/zk/prove-offer") {
      if (b?.offerId === "ofr_seoul_glow_rejuran_second") return reply(res, 500, { error: "Cannot satisfy constraint" });
      return reply(res, 200, { ...BUNDLE, offerId: b?.offerId, provingMs: 458 });
    }
    if (req.url === "/api/zk/verify-offer") {
      const bundle = b?.bundle as ZkOfferProofBundle;
      const ok = b?.clinicId === "cln_mint" && bundle.subjectId === BUNDLE.subjectId;
      return reply(res, 200, { ok, reason: ok ? "모든 조건이 온체인 해시 기준으로 증명됨" : "증명 검증 실패", commitment: "0x01", today: bundle.today, conditions: [] });
    }
    if (req.url === "/api/offers") {
      return reply(res, 200, [
        { id: "ofr_mint_rejuran_first_visit", clinicId: "cln_mint", procedureId: "rejuran_healer", title: "첫 방문 1cc 이벤트", benefit: "리쥬란 1cc 99,000원", clauses: [{ clinic: 2, maxCount: 0 }], clinic: "민트피부과의원", conditions: ["c"] },
        { id: "ofr_elsewhere", clinicId: "cln_not_in_pibook", procedureId: "x", title: "X", benefit: "X", clauses: [], clinic: "X", conditions: [] },
      ]);
    }
    if (req.url === "/api/ledger") {
      return reply(res, 200, {
        deployment: { chainId: 84532, registry: "0xcf47", secondsPerDay: 60 },
        personas: [{ id: "cus_lin", name: "Lin", note: "must not leak" }],
        ledger: [
          { tx: "0xt3", block: 3, timestamp: 1792818229000, subjectId: "0xs2", commitment: "0xc3", version: 2, day: 30 },
          { tx: "0xt2", block: 2, timestamp: 1792818169000, subjectId: "0xs1", commitment: "0xc2", version: 1, day: 29 },
          { tx: "0xt1", block: 1, timestamp: 1792818109000, subjectId: "0xs2", commitment: "0xc1", version: 1, day: 28 },
        ],
      });
    }
    reply(res, 404, { error: "not found" });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
});

const ENV = { url: process.env.ZK_SERVER_URL, timeout: process.env.ZK_TIMEOUT_MS };
function configure(value: string | undefined) {
  if (value === undefined) delete process.env.ZK_SERVER_URL;
  else process.env.ZK_SERVER_URL = value;
}

afterEach(() => {
  seen.length = 0;
  delayMs = 0;
  configure(ENV.url);
  if (ENV.timeout === undefined) delete process.env.ZK_TIMEOUT_MS;
  else process.env.ZK_TIMEOUT_MS = ENV.timeout;
});

describe("identity mapping", () => {
  it("maps customer ids and customer agent ids to GlowPass personas", () => {
    expect(toGlowpassPersona("cag_7f3k2")).toBe("cus_yuki");
    expect(toGlowpassPersona("cus_yuki_done")).toBe("cus_yuki");
    expect(toGlowpassPersona("cus_yuki")).toBe("cus_yuki");
    expect(toGlowpassPersona("cag_4n8vd")).toBe("cus_lin");
    expect(toGlowpassPersona("cus_lin")).toBe("cus_lin");
    expect(toGlowpassPersona("cag_2q9wk")).toBe("cus_emily");
    expect(toGlowpassPersona("cus_emily")).toBe("cus_emily");
  });

  it("has no wallet for residents or unknown customers", () => {
    expect(toGlowpassPersona("cus_jisoo")).toBeNull();
    expect(toGlowpassPersona("cag_8h3tb")).toBeNull();
    expect(toGlowpassPersona("cag_unknown")).toBeNull();
    expect(PERSONA_TABLE.map((r) => r.glowpass)).toEqual(["cus_yuki", "cus_lin", "cus_emily"]);
  });

  it("maps the five spec clinics both ways", () => {
    for (const id of ["cln_seoul_glow", "cln_mint", "cln_hanbit", "cln_ara", "cln_dahye"]) {
      expect(fromGlowpassClinic(toGlowpassClinic(id)!)).toBe(id);
    }
    expect(Object.keys(CLINIC_TABLE)).toHaveLength(5);
    expect(toGlowpassClinic("cln_unknown")).toBeNull();
  });
});

describe("not configured", () => {
  it("returns null everywhere without calling anything", async () => {
    configure(undefined);
    expect(zkEnabled()).toBe(false);
    expect(await matchOffers("cag_7f3k2")).toBeNull();
    expect(await proveOffer("cag_7f3k2", BUNDLE.offerId)).toBeNull();
    expect(await verifyOffer("cln_mint", BUNDLE)).toBeNull();
    expect(await ledgerSummary()).toBeNull();
    expect(seen).toHaveLength(0);
  });
});

describe("against a GlowPass server", () => {
  it("matches offers with GlowPass ids on the wire and PibooK ids back", async () => {
    configure(url);
    expect(zkEnabled()).toBe(true);
    const offers = await matchOffers("cag_7f3k2");
    expect(seen[0]).toMatchObject({ method: "POST", path: "/api/zk/match-offers", body: { persona: "cus_yuki" }, clientId: "pibook-app" });
    expect(offers).toEqual([
      { clinicId: "cln_mint", offerId: "ofr_mint_rejuran_first_visit", title: "첫 방문 1cc 이벤트", eligible: true },
      { clinicId: "cln_seoul_glow", offerId: "ofr_seoul_glow_rejuran_second", title: "리쥬란 2회차 패키지 10%", eligible: false },
    ]);
    const detailed = await matchOffersDetailed("cus_emily");
    expect(detailed?.[0]).toMatchObject({ procedureId: "rejuran_healer", benefit: "리쥬란 1cc 99,000원", conditions: ["시술 무관 @ 민트피부과의원 기록 0건"] });
  });

  it("does not ask GlowPass about customers without a wallet", async () => {
    configure(url);
    expect(await matchOffers("cus_jisoo")).toBeNull();
    expect(await proveOffer("cag_unknown", BUNDLE.offerId)).toBeNull();
    expect(seen).toHaveLength(0);
  });

  it("proves an offer and returns exactly the contract bundle", async () => {
    configure(url);
    const bundle = await proveOffer("cag_4n8vd", BUNDLE.offerId);
    expect(seen[0].body).toEqual({ persona: "cus_lin", offerId: BUNDLE.offerId });
    expect(bundle).toEqual(BUNDLE); // provingMs dropped
  });

  it("returns null when the wallet cannot satisfy the offer", async () => {
    configure(url);
    expect(await proveOffer("cag_7f3k2", "ofr_seoul_glow_rejuran_second")).toBeNull();
  });

  it("verifies a bundle for the right clinic and rejects it for another", async () => {
    configure(url);
    expect(await verifyOffer("cln_mint", BUNDLE)).toEqual({ ok: true, reason: "모든 조건이 온체인 해시 기준으로 증명됨" });
    expect(seen[0].body).toEqual({ clinicId: "cln_mint", bundle: BUNDLE });
    expect(await verifyOffer("cln_hanbit", BUNDLE)).toEqual({ ok: false, reason: "증명 검증 실패" });
  });

  it("rejects unknown clinics and malformed bundles locally", async () => {
    configure(url);
    expect(await verifyOffer("cln_unknown", BUNDLE)).toMatchObject({ ok: false });
    expect(await verifyOffer("cln_mint", { ...BUNDLE, proofs: [] })).toMatchObject({ ok: false, reason: "malformed proof bundle" });
    expect(seen).toHaveLength(0);
  });

  it("lists public offer rules with PibooK clinic ids and no circuit codes", async () => {
    configure(url);
    expect(await publicOffers()).toEqual([
      { offerId: "ofr_mint_rejuran_first_visit", clinicId: "cln_mint", procedureId: "rejuran_healer", title: "첫 방문 1cc 이벤트", benefit: "리쥬란 1cc 99,000원", conditions: ["c"] },
    ]);
  });

  it("summarizes the public ledger without persona data", async () => {
    configure(url);
    const summary = await ledgerSummary(2);
    expect(summary).toEqual({
      chainId: 84532,
      registry: "0xcf47",
      secondsPerDay: 60,
      records: 3,
      pseudonyms: 2,
      latest: [
        { tx: "0xt3", block: 3, at: new Date(1792818229000).toISOString(), subjectId: "0xs2", version: 2, day: 30 },
        { tx: "0xt2", block: 2, at: new Date(1792818169000).toISOString(), subjectId: "0xs1", version: 1, day: 29 },
      ],
    });
    expect(JSON.stringify(summary)).not.toContain("must not leak");
  });

  it("reads the bundle from A2A message metadata", () => {
    expect(readOfferProof({ [ZK_OFFER_PROOF_METADATA_KEY]: { ...BUNDLE, provingMs: 1 } })).toEqual(BUNDLE);
    expect(readOfferProof({ referralToken: "x" })).toBeNull();
    expect(readOfferProof(undefined)).toBeNull();
  });
});

describe("failures never throw", () => {
  it("times out to null", async () => {
    configure(url);
    process.env.ZK_TIMEOUT_MS = "50";
    delayMs = 500;
    expect(await matchOffers("cag_7f3k2")).toBeNull();
    expect(await proveOffer("cag_7f3k2", BUNDLE.offerId)).toBeNull();
    expect(await verifyOffer("cln_mint", BUNDLE)).toBeNull();
    expect(await ledgerSummary()).toBeNull();
  });

  it("returns null when the server is unreachable", async () => {
    configure("http://127.0.0.1:9/");
    expect(await matchOffers("cag_7f3k2")).toBeNull();
    expect(await verifyOffer("cln_mint", BUNDLE)).toBeNull();
  });
});
