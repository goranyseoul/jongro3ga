import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { routeFetch } from "../../a2a/__fixtures__/route-fetch";
import { verifyAgentToken } from "../../a2a/auth";
import { clock, setClock } from "../../clock";
import { seedOffers, setupPlatformTest, teardownPlatformTest } from "./__fixtures__/offer-cache";
import { refreshOfferCache } from "./offer-cache";
import { platformStore } from "./store";

beforeEach(setupPlatformTest);
afterEach(teardownPlatformTest);

/** routeFetch, except that Mint's rpc answers clinic.offers itself (WP3's clinic agent is not there yet). */
function fetchWithMintOffers(seen: { skillId?: unknown; caller?: unknown }[]): typeof fetch {
  return async (input, init) => {
    const req = new Request(input, init);
    if (!req.url.endsWith("/a2a/clinics/mint/rpc")) return routeFetch(req);
    const body = (await req.json()) as { id: string; params: { message: { metadata: { skillId: unknown }; contextId: string } } };
    seen.push({ skillId: body.params.message.metadata.skillId, caller: await verifyAgentToken(req.headers.get("authorization")) });
    const offers = { ...seedOffers().find((o) => o.clinicId === "cln_mint")!, items: seedOffers().find((o) => o.clinicId === "cln_mint")!.items.slice(0, 1) };
    return Response.json({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        task: {
          id: "tsk_offers",
          contextId: body.params.message.contextId,
          status: { state: "TASK_STATE_COMPLETED" },
          artifacts: [{ artifactId: "art_offers", parts: [{ data: offers }] }],
        },
      },
    });
  };
}

describe("refreshOfferCache", () => {
  it("stores what clinic.offers returns and keeps the old cache for clinics that failed", async () => {
    const before = await platformStore.offerCache("cln_ara");
    setClock("2026-11-12T16:00:00+09:00");
    const seen: { skillId?: unknown; caller?: unknown }[] = [];
    const result = await refreshOfferCache({ fetchImpl: fetchWithMintOffers(seen) });

    expect(result.updated).toEqual(["cln_mint"]);
    // The other clinic agents are still the T04 stub that answers FAILED.
    expect(result.failed.map((f) => f.clinicId).sort()).toEqual(["cln_ara", "cln_dahye", "cln_hanbit", "cln_seoul_glow"]);
    expect(result.failed[0].reason).toContain("TASK_STATE_FAILED");
    expect(seen).toEqual([{ skillId: "clinic.offers", caller: { agentId: "agt_platform", role: "platform" } }]);

    const mint = await platformStore.offerCache("cln_mint");
    expect(mint).toMatchObject({ clinicId: "cln_mint", fetchedAt: clock.nowIso() });
    expect(mint!.offers.items).toHaveLength(1);
    expect(await platformStore.offerCache("cln_ara")).toEqual(before);
  });
});
