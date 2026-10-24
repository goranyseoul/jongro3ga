import { listA2ALog } from "../../../../lib/a2a/log";
import { getStore } from "../../../../lib/store";

// GET /api/ops/a2a-log?agentId=&skillId=&state=&contextId= (05 /ops/a2a-log). Entries are stored masked.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams;
  const pick = (key: string) => p.get(key) ?? undefined;
  const entries = await listA2ALog(getStore(), {
    agentId: pick("agentId"),
    skillId: pick("skillId"),
    state: pick("state"),
    contextId: pick("contextId"),
  });
  return Response.json({ entries });
}
