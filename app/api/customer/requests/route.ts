import { after } from "next/server";
import { listRequests } from "@/lib/agents/customer/bff";
import { createDraft, runRequest, startRequest } from "@/lib/agents/customer/orchestrator";
import { customerContext, errorResponse, readJson } from "../_lib/context";
import { CreateRequestSchema } from "../_lib/schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    return Response.json({ requests: await listRequests(ctx.store, ctx.profile.id) });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * Creates a request from a condition card. The agent asks platform.recipe when the amount is missing.
 * With `start: true` the match -> quotes -> judge run continues after the response (09: never awaited in the BFF);
 * the screen polls GET /api/customer/requests/[id].
 */
export async function POST(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const body = await readJson(request, CreateRequestSchema);
    const draft = await createDraft(ctx.deps, ctx.profile.id, body.condition, body.rawUtterance);
    if (!body.start) return Response.json({ requestId: draft.id, request: draft }, { status: 201 });
    const started = await startRequest(ctx.deps, ctx.profile.id, draft.id);
    after(() => runRequest(ctx.deps, ctx.profile.id, draft.id).catch((error) => console.error("[customer] run failed", error)));
    return Response.json({ requestId: draft.id, request: started }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
