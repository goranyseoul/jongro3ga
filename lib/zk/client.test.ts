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
