// POST /a2a/clinics/{slug}/rpc. The handler sees the clinic id as SkillContext.self.agentId.
import { resolveClinicId } from "../../../../../lib/a2a/cards";
import { handleRpcRequest } from "../../../../../lib/a2a/server";
import { clinicAgent } from "../../../../../lib/agents/clinic/definition";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return handleRpcRequest(clinicAgent, req, await resolveClinicId(decodeURIComponent(slug)));
}
