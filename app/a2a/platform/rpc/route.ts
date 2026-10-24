// POST /a2a/platform/rpc: A2A 1.0 JSON-RPC (SendMessage, GetTask, CancelTask).
import { handleRpcRequest } from "../../../../lib/a2a/server";
import { PLATFORM_AGENT_ID, platformAgent } from "../../../../lib/agents/platform/definition";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleRpcRequest(platformAgent, req, PLATFORM_AGENT_ID);
}
