// GET /api/zk/offers: ZK offers the signed-in customer can claim, matched where her chart lives (GlowPass
// wallet). Read-only; no proof is built here. Signed out: Yuki when DEMO_MODE=true, otherwise 401.
import { getSessionUser } from "../../../../lib/auth/session";
import { matchOffersDetailed, zkEnabled } from "../../../../lib/zk";
import { DEMO_FALLBACK_CUSTOMER_AGENT_ID, toGlowpassPersona } from "../../../../lib/zk/identity";

export async function GET(request: Request) {
  const user = await getSessionUser(request.headers);
  const customerAgentId = user ? (user.role === "customer" ? user.customerAgentId : null) : process.env.DEMO_MODE === "true" ? DEMO_FALLBACK_CUSTOMER_AGENT_ID : null;
  if (!user && !customerAgentId) return Response.json({ error: "sign in required" }, { status: 401 });
  if (!customerAgentId) return Response.json({ error: "customer accounts only" }, { status: 403 });

  if (!zkEnabled()) return Response.json({ status: "off", offers: [] });
  if (!toGlowpassPersona(customerAgentId)) return Response.json({ status: "no_wallet", offers: [] });
  const offers = await matchOffersDetailed(customerAgentId);
  if (!offers) return Response.json({ status: "unavailable", offers: [] });
  return Response.json({ status: "ok", offers: offers.filter((o) => o.eligible) });
}
