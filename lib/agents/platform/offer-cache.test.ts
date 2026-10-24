import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { routeFetch } from "../../a2a/__fixtures__/route-fetch";
import { verifyAgentToken } from "../../a2a/auth";
import { clock, setClock } from "../../clock";
import { seedOffers, setupPlatformTest, teardownPlatformTest } from "./__fixtures__/offer-cache";
import { refreshOfferCache } from "./offer-cache";
import { platformStore } from "./store";

beforeEach(setupPlatformTest);
afterEach(teardownPlatformTest);

/** routeFetch, except that Ara's rpc answers clinic.offers with a FAILED task (a clinic agent outage). */
function fetchWithAraDown(seen: { skillId?: unknown; caller?: unknown }[]): typeof fetch {
  return async (input, init) => {
    const req = new Request(input, init);
    if (!req.url.endsWith("/a2a/clinics/ara/rpc")) return routeFetch(req);
    const body = (await req.json()) as { id: string; params: { message: { metadata: { skillId: unknown }; contextId: string } } };
    seen.push({ skillId: body.params.message.metadata.skillId, caller: await verifyAgentToken(req.headers.get("authorization")) });
    return Response.json({
      jsonrpc: "2.0",
      id: body.id,
      result: {
        task: {
          id: "tsk_offers_down",
          contextId: body.params.message.contextId,
          status: { state: "TASK_STATE_FAILED", message: { messageId: "m1", role: "ROLE_AGENT", parts: [{ text: "clinic agent down" }] } },
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
    const result = await refreshOfferCache({ fetchImpl: fetchWithAraDown(seen) });

    // The four clinic agents behind the real route (WP3) answer; Ara's outage leaves its cache as it was.
    expect([...result.updated].sort()).toEqual(["cln_dahye", "cln_hanbit", "cln_mint", "cln_seoul_glow"]);
    expect(result.failed.map((f) => f.clinicId)).toEqual(["cln_ara"]);
    expect(result.failed[0].reason).toContain("TASK_STATE_FAILED");
    expect(seen).toEqual([{ skillId: "clinic.offers", caller: { agentId: "agt_platform", role: "platform" } }]);

    const mint = await platformStore.offerCache("cln_mint");
    expect(mint).toMatchObject({ clinicId: "cln_mint", fetchedAt: clock.nowIso() });
    // Mint: three regular menu items plus the proof-only 1cc event (06 seed table).
    expect(mint!.offers.items).toHaveLength(4);
    expect(mint!.offers.items.filter((item) => item.event)).toHaveLength(1);
    expect(await platformStore.offerCache("cln_ara")).toEqual(before);
  });
});
