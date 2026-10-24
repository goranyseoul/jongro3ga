// GET /a2a/platform/agent-card.json (also /.well-known/agent-card.json via next.config.ts rewrite).
import { handleCardRequest } from "../../../../lib/a2a/server";
import { PLATFORM_AGENT_ID, platformAgent } from "../../../../lib/agents/platform/definition";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handleCardRequest(platformAgent, req, PLATFORM_AGENT_ID);
}
