import { meView } from "@/lib/agents/customer/bff";
import { customerContext, errorResponse } from "../_lib/context";

export const dynamic = "force-dynamic";

/** The signed-in customer: profile, eligibility, own Agent Card and current consents. */
export async function GET(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    return Response.json(await meView(ctx.store, ctx.profile, ctx.demo, ctx.baseUrl));
  } catch (error) {
    return errorResponse(error);
  }
}
