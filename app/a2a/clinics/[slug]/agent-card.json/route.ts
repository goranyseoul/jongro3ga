// GET /a2a/clinics/{slug}/agent-card.json. The segment may be the slug ("mint") or the clinic id ("cln_mint").
import { resolveClinicId } from "../../../../../lib/a2a/cards";
import { handleCardRequest } from "../../../../../lib/a2a/server";
import { clinicAgent } from "../../../../../lib/agents/clinic/definition";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return handleCardRequest(clinicAgent, req, await resolveClinicId(decodeURIComponent(slug)));
}
