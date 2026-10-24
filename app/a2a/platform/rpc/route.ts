import { platformCard } from "../../../../lib/a2a/cards";
import { makeRpcRoute } from "../../../../lib/a2a/server";
import { platformExecutor } from "../../../../lib/agents/platform/executor";
import { PLATFORM_AGENT_ID } from "../../../../lib/store/collections";

// Platform agent JSON-RPC endpoint (03 "바인딩과 엔드포인트").
export const dynamic = "force-dynamic";

export const POST = makeRpcRoute({
  role: "platform",
  agentKey: () => "platform",
  agentId: () => PLATFORM_AGENT_ID,
  card: async () => platformCard(),
  executor: () => platformExecutor(),
});
