import { answerBookingInput } from "@/lib/agents/customer/orchestrator";
import { customerContext, errorResponse, readJson } from "../../../_lib/context";
import { InputValuesSchema } from "../../../_lib/schemas";

export const dynamic = "force-dynamic";

/** The customer answers what a clinic asked for (TASK_STATE_INPUT_REQUIRED) that the agent could not fill. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const { id } = await params;
    const body = await readJson(request, InputValuesSchema);
    return Response.json({ booking: await answerBookingInput(ctx.deps, ctx.profile.id, id, body.values) });
  } catch (error) {
    return errorResponse(error);
  }
}
