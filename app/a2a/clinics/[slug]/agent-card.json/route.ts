import { clinicCard } from "../../../../../lib/a2a/cards";
import { resolveClinicCardInput } from "../../../../../lib/a2a/directory";

// Public clinic Agent Card, one per clinic in the platform registry (03 "바인딩과 엔드포인트").
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const clinic = await resolveClinicCardInput(slug);
  if (!clinic) return Response.json({ error: "clinic not found" }, { status: 404 });
  return Response.json(clinicCard(clinic));
}
