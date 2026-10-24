import { requestView } from "@/lib/agents/customer/bff";
import { customerContext, errorResponse, notFound } from "../../_lib/context";

export const dynamic = "force-dynamic";

/** Request progress: status, the A2A timeline of the agents, quotes with the platform's verdicts, next action. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const { id } = await params;
    const view = await requestView(ctx.store, ctx.profile.id, id);
    return view ? Response.json(view) : notFound();
  } catch (error) {
    return errorResponse(error);
  }
}
