import { submitOutcome } from "@/lib/agents/customer/orchestrator";
import { customerContext, errorResponse, readJson } from "../../../_lib/context";
import { OutcomeFormSchema } from "../../../_lib/schemas";

export const dynamic = "force-dynamic";

/** D0 record: platform.submit_outcome (with consent), the booked procedure into the records, D7/D30 due items. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const { id } = await params;
    const form = await readJson(request, OutcomeFormSchema);
    return Response.json(await submitOutcome(ctx.deps, ctx.profile.id, id, form));
  } catch (error) {
    return errorResponse(error);
  }
}
