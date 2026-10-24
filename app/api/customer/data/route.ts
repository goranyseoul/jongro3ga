import { deleteAll } from "@/lib/agents/customer/bff";
import { customerContext, errorResponse } from "../_lib/context";

export const dynamic = "force-dynamic";

/** "전체 삭제": removes this customer's profile, consents, records, requests and inbox from the agent store. */
export async function DELETE(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    return Response.json({ removed: await deleteAll(ctx.store, ctx.profile.id), demo: ctx.demo });
  } catch (error) {
    return errorResponse(error);
  }
}
