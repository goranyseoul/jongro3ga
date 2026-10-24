import { after } from "next/server";
import { runRequest, startRequest } from "@/lib/agents/customer/orchestrator";
import { customerContext, errorResponse, readJson } from "../../../_lib/context";
import { StartRequestSchema } from "../../../_lib/schemas";

export const dynamic = "force-dynamic";

/** [이 조건으로 찾기]: applies the edited condition card and starts match -> quotes -> judge in the background. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const { id } = await params;
    const body = await readJson(request, StartRequestSchema);
    const started = await startRequest(ctx.deps, ctx.profile.id, id, body.condition ?? {});
    after(() => runRequest(ctx.deps, ctx.profile.id, id).catch((error) => console.error("[customer] run failed", error)));
    return Response.json({ requestId: id, request: started }, { status: 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
