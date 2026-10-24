import * as clinicCardRoute from "../../../app/a2a/clinics/[slug]/agent-card.json/route";
import * as clinicRpcRoute from "../../../app/a2a/clinics/[slug]/rpc/route";
import * as customerCardRoute from "../../../app/a2a/customers/[agentId]/agent-card.json/route";
import * as customerRpcRoute from "../../../app/a2a/customers/[agentId]/rpc/route";
import * as platformCardRoute from "../../../app/a2a/platform/agent-card.json/route";
import * as jwksRoute from "../../../app/a2a/platform/jwks.json/route";
import * as platformRpcRoute from "../../../app/a2a/platform/rpc/route";
import { getStore } from "../../store";
import { COLLECTIONS, PLATFORM_AGENT_ID } from "../../store/collections";
import { registerAgent } from "../auth";
import { clinicFixtures } from "./clinics";

// Test helpers for A2A round trips without a server: `routeFetch` hands a request to the app/a2a route
// handler its URL names, the way Next would. Pass it as `fetchImpl` to lib/a2a/client.ts.

const ctx = <P>(params: P) => ({ params: Promise.resolve(params) });

/** A fetch that dispatches to the app/a2a route handlers by path. Unknown paths answer 404. */
export const routeFetch: typeof fetch = async (input, init) => {
  const req = new Request(input, init);
  const path = new URL(req.url).pathname;
  const post = req.method === "POST";
  let m: RegExpExecArray | null;

  if (path === "/a2a/platform/rpc" && post) return platformRpcRoute.POST(req, ctx({}));
  if (path === "/a2a/platform/agent-card.json" || path === "/.well-known/agent-card.json") return platformCardRoute.GET();
  if (path === "/a2a/platform/jwks.json") return jwksRoute.GET();
  if ((m = /^\/a2a\/clinics\/([^/]+)\/rpc$/.exec(path)) && post) return clinicRpcRoute.POST(req, ctx({ slug: m[1] }));
  if ((m = /^\/a2a\/clinics\/([^/]+)\/agent-card\.json$/.exec(path))) return clinicCardRoute.GET(req, ctx({ slug: m[1] }));
  if ((m = /^\/a2a\/customers\/([^/]+)\/rpc$/.exec(path)) && post) return customerRpcRoute.POST(req, ctx({ agentId: m[1] }));
  if ((m = /^\/a2a\/customers\/([^/]+)\/agent-card\.json$/.exec(path))) return customerCardRoute.GET(req, ctx({ agentId: m[1] }));
  return new Response("not found", { status: 404 });
};

/** Customer agents registered by `seedA2A`. */
export const TEST_CUSTOMERS = { yuki: "cag_7f3k2", other: "cag_other" } as const;

/** Puts the five clinics in the platform registry and registers the platform, clinic and two customer agents. */
export async function seedA2A(): Promise<void> {
  const store = getStore();
  for (const clinic of clinicFixtures()) {
    await store.put("platform", COLLECTIONS.platform.clinicRegistry, clinic);
    await registerAgent({ agentId: clinic.id, role: "clinic", ownerId: clinic.id, slug: clinic.slug });
  }
  await registerAgent({ agentId: PLATFORM_AGENT_ID, role: "platform", ownerId: "pibu" });
  await registerAgent({ agentId: TEST_CUSTOMERS.yuki, role: "customer", ownerId: "cus_yuki" });
  await registerAgent({ agentId: TEST_CUSTOMERS.other, role: "customer", ownerId: "cus_other" });
}
