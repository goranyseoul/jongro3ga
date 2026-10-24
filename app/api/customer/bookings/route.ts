import { listBookings } from "@/lib/agents/customer/bff";
import { customerContext, errorResponse } from "../_lib/context";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    return Response.json({ bookings: await listBookings(ctx.store, ctx.profile.id) });
  } catch (error) {
    return errorResponse(error);
  }
}
