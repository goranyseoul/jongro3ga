import { inboxOf } from "@/lib/agents/customer/inbox";
import { customerContext, errorResponse } from "../_lib/context";

export const dynamic = "force-dynamic";

/** In-app inbox: notifications from clinics and the platform, booking confirmations, D7/D30 check-ins. */
export async function GET(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    return Response.json(await inboxOf(ctx.store, ctx.profile.id));
  } catch (error) {
    return errorResponse(error);
  }
}
