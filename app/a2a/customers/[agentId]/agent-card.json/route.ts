import { verifyAgentToken } from "../../../../../lib/a2a/auth";
import { customerCard } from "../../../../../lib/a2a/cards";
import { resolveCustomerAgent } from "../../../../../lib/a2a/directory";

// Customer Agent Card. Not public: any valid agent token may read it, no token gets 401 (03 "인증과 신뢰").
export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ agentId: string }> }): Promise<Response> {
  const caller = await verifyAgentToken(req.headers.get("authorization"));
  if (!caller) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  const { agentId } = await ctx.params;
  const agent = await resolveCustomerAgent(agentId);
  if (!agent) return Response.json({ error: "agent not found" }, { status: 404 });
  return Response.json(customerCard(agent.agentId));
}
