import * as clinicCardRoute from "../../app/a2a/clinics/[slug]/agent-card.json/route";
import * as clinicRpcRoute from "../../app/a2a/clinics/[slug]/rpc/route";
import * as customerCardRoute from "../../app/a2a/customers/[agentId]/agent-card.json/route";
import * as customerRpcRoute from "../../app/a2a/customers/[agentId]/rpc/route";
import * as platformCardRoute from "../../app/a2a/platform/agent-card.json/route";
import * as jwksRoute from "../../app/a2a/platform/jwks.json/route";
import * as platformRpcRoute from "../../app/a2a/platform/rpc/route";

// A fetch that hands A2A requests to the app/a2a route handlers in this process, the way Next would.
// Server code (BFF routes, demo controls) uses it so a single dev or demo process never calls itself over HTTP.
// Anything that is not an /a2a path goes to the real fetch.
const ctx = <P>(params: P) => ({ params: Promise.resolve(params) });

export const inProcessFetch: typeof fetch = async (input, init) => {
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
  return fetch(req);
};
