import { homeView } from "@/lib/agents/customer/bff";
import { customerContext, errorResponse } from "../_lib/context";

export const dynamic = "force-dynamic";

/** Home screen: agent summary, requests in progress, bookings, next sessions and the inbox. */
export async function GET(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    return Response.json(await homeView(ctx.store, ctx.profile, ctx.demo, ctx.baseUrl));
  } catch (error) {
    return errorResponse(error);
  }
}
