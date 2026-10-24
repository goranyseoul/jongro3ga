// POST /a2a/customers/{agentId}/rpc.
import { handleRpcRequest } from "../../../../../lib/a2a/server";
import { customerAgent } from "../../../../../lib/agents/customer/definition";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await ctx.params;
  return handleRpcRequest(customerAgent, req, decodeURIComponent(agentId));
}
