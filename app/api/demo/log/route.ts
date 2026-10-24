import { agentTimeline, listA2ALog } from "../../../../lib/a2a/log";
import { getStore } from "../../../../lib/store";

// GET /api/demo/log?contextId=&skillId=&agentId=: the A2A call log (masked, proofs compacted), newest last.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const contextId = url.searchParams.get("contextId") ?? undefined;
  const skillId = url.searchParams.get("skillId") ?? undefined;
  const agentId = url.searchParams.get("agentId") ?? undefined;
  const store = getStore();
  if (contextId && url.searchParams.get("view") === "timeline") {
    return Response.json({ timeline: await agentTimeline(store, contextId) });
  }
  const entries = await listA2ALog(store, { contextId, skillId, agentId });
  return Response.json({ entries: entries.slice(-200) });
}
