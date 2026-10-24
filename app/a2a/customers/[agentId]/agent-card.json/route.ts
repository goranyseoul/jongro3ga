// GET /a2a/customers/{agentId}/agent-card.json. Needs a bearer token (03 endpoint table).
import { handleCardRequest } from "../../../../../lib/a2a/server";
import { customerAgent } from "../../../../../lib/agents/customer/definition";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await ctx.params;
  return handleCardRequest(customerAgent, req, decodeURIComponent(agentId));
}
