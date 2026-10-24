import { answerCheckin } from "@/lib/agents/customer/orchestrator";
import { customerContext, errorResponse, readJson } from "../../../_lib/context";
import { CheckinAnswerSchema } from "../../../_lib/schemas";

export const dynamic = "force-dynamic";

/** Answers a D7/D30 check-in (scheduled or a platform customer.checkin task). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const { id } = await params;
    const answers = await readJson(request, CheckinAnswerSchema);
    return Response.json(await answerCheckin(ctx.deps, ctx.profile.id, id, answers));
  } catch (error) {
    return errorResponse(error);
  }
}
