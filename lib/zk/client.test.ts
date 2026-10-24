import { afterEach, describe, expect, it, vi } from "vitest";
import { PIBU_SCHEMAS } from "../a2a/schemas";
import { proveOffer, toOfferProof } from "./client";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const bundle = {
  subjectId: "0x" + "ab".repeat(32),
  offerId: "ofr_mint_rejuran_first_visit",
  today: 100,
  proofs: [{ proof: "0x1234", publicInputs: ["1", "100", "0", "2", "0", "100000", "0", "0"] }],
};

describe("zk client", () => {
  it("builds a valid pibu/offer-proof@1 with the Base Sepolia defaults", () => {
    const proof = toOfferProof(bundle, "cln_mint");
    expect(proof.chainId).toBe(84532);
    expect(proof.registry).toBe("0xcf47152e720508bf8c757a55aa30956ca8b58857");
    expect(PIBU_SCHEMAS["pibu/offer-proof@1"].safeParse(proof).success).toBe(true);
  });

  it("reads chain id and registry from the environment", () => {
    vi.stubEnv("ZK_CHAIN_ID", "31337");
    vi.stubEnv("ZK_REGISTRY_ADDRESS", "0x" + "11".repeat(20));
    const proof = toOfferProof(bundle, "cln_mint");
    expect(proof.chainId).toBe(31337);
    expect(proof.registry).toBe("0x" + "11".repeat(20));
  });

  it("posts to ZK_SERVER_URL and includes the server error text on failure", async () => {
    vi.stubEnv("ZK_SERVER_URL", "http://zk.test:4000/");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ error: "Cannot satisfy constraint" }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(proveOffer("cus_yuki", "ofr_x")).rejects.toThrow(/500.*Cannot satisfy constraint/);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://zk.test:4000/api/zk/prove-offer");
    expect(JSON.parse(init.body as string)).toEqual({ persona: "cus_yuki", offerId: "ofr_x" });
  });
});

describe("toOfferProof with empty env values", () => {
  it("falls back to the deployment defaults when ZK_REGISTRY_ADDRESS and ZK_CHAIN_ID are empty (.env.example)", async () => {
    const { toOfferProof } = await import("./client");
    const { OfferProofV1Schema } = await import("../a2a/schemas");
    const saved = { r: process.env.ZK_REGISTRY_ADDRESS, c: process.env.ZK_CHAIN_ID };
    process.env.ZK_REGISTRY_ADDRESS = "";
    process.env.ZK_CHAIN_ID = "";
    try {
      const proof = toOfferProof(
        { subjectId: `0x${"1".repeat(64)}`, offerId: "ofr_mint_rejuran_first_visit", today: 29880442, proofs: [{ proof: "0x1", publicInputs: ["0x1"] }] },
        "cln_mint",
      );
      expect(proof.registry).toBe("0xcf47152e720508bf8c757a55aa30956ca8b58857");
      expect(proof.chainId).toBe(84532);
      expect(OfferProofV1Schema.safeParse(proof).success).toBe(true);
    } finally {
      process.env.ZK_REGISTRY_ADDRESS = saved.r;
      process.env.ZK_CHAIN_ID = saved.c;
      if (saved.r === undefined) delete process.env.ZK_REGISTRY_ADDRESS;
      if (saved.c === undefined) delete process.env.ZK_CHAIN_ID;
    }
  });
});
