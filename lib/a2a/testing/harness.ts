// Test harness: routes A2A HTTP calls made through lib/a2a/client.ts to the real Next.js route handlers,
// so tests exercise the same code as `next start` without a server. Test-only module.
import * as clinicCard from "../../../app/a2a/clinics/[slug]/agent-card.json/route";
import * as clinicRpc from "../../../app/a2a/clinics/[slug]/rpc/route";
import * as customerCard from "../../../app/a2a/customers/[agentId]/agent-card.json/route";
import * as customerRpc from "../../../app/a2a/customers/[agentId]/rpc/route";
import * as platformCard from "../../../app/a2a/platform/agent-card.json/route";
import * as platformJwks from "../../../app/a2a/platform/jwks.json/route";
import * as platformRpc from "../../../app/a2a/platform/rpc/route";
import { resetClock, setClock } from "../../clock";
import { resetStore } from "../../store";
import { clearA2AClientCache, setA2AFetch } from "../client";

export const BASE = "http://pibu.test";
export const DEMO_NOW = "2026-10-24T10:00:00+09:00";

/** Dispatches a Request to the matching route handler, like the Next.js router would. */
export async function dispatch(req: Request): Promise<Response> {
  const { pathname } = new URL(req.url);
  const method = req.method.toUpperCase();
  let m: RegExpExecArray | null;
  if (pathname === "/a2a/platform/agent-card.json" || pathname === "/.well-known/agent-card.json") {
    if (method === "GET") return platformCard.GET(req);
  } else if (pathname === "/a2a/platform/rpc") {
    if (method === "POST") return platformRpc.POST(req);
  } else if (pathname === "/a2a/platform/jwks.json") {
    if (method === "GET") return platformJwks.GET();
  } else if ((m = /^\/a2a\/clinics\/([^/]+)\/agent-card\.json$/.exec(pathname))) {
    if (method === "GET") return clinicCard.GET(req, { params: Promise.resolve({ slug: m[1] }) });
  } else if ((m = /^\/a2a\/clinics\/([^/]+)\/rpc$/.exec(pathname))) {
    if (method === "POST") return clinicRpc.POST(req, { params: Promise.resolve({ slug: m[1] }) });
  } else if ((m = /^\/a2a\/customers\/([^/]+)\/agent-card\.json$/.exec(pathname))) {
    if (method === "GET") return customerCard.GET(req, { params: Promise.resolve({ agentId: m[1] }) });
  } else if ((m = /^\/a2a\/customers\/([^/]+)\/rpc$/.exec(pathname))) {
    if (method === "POST") return customerRpc.POST(req, { params: Promise.resolve({ agentId: m[1] }) });
  } else {
    return new Response("not found", { status: 404 });
  }
  return new Response("method not allowed", { status: 405 });
}

/** Fresh store, fixed demo clock, demo-mode secrets, client wired to the route handlers. */
export function setupA2ATest(at: string = DEMO_NOW): void {
  process.env.DEMO_MODE = "true";
  process.env.PUBLIC_BASE_URL = BASE;
  process.env.A2A_BLOCKING_WAIT_MS = "0";
  resetStore();
  resetClock();
  setClock(at);
  clearA2AClientCache();
  setA2AFetch((url, init) => dispatch(new Request(url, init)));
}

export function teardownA2ATest(): void {
  setA2AFetch(undefined);
  clearA2AClientCache();
  resetClock();
}

export function rpcRequest(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "A2A-Version": "1.0", ...headers },
    body: JSON.stringify(body),
  });
}
