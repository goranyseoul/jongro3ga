import { customerCard } from "../../../../../lib/a2a/cards";
import { resolveCustomerAgent } from "../../../../../lib/a2a/directory";
import { makeRpcRoute } from "../../../../../lib/a2a/server";
import { customerExecutor } from "../../../../../lib/agents/customer/executor";

// Customer agent JSON-RPC endpoint, one per registered customer agent (03 "바인딩과 엔드포인트").
export const dynamic = "force-dynamic";

export const POST = makeRpcRoute<{ agentId: string }>({
  role: "customer",
  agentKey: ({ agentId }) => `customer:${agentId}`,
  agentId: async ({ agentId }) => (await resolveCustomerAgent(agentId))?.agentId,
  card: async ({ agentId }) => ((await resolveCustomerAgent(agentId)) ? customerCard(agentId) : undefined),
  executor: ({ agentId }) => customerExecutor(agentId),
});
