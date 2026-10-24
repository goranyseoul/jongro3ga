import { bookingView } from "@/lib/agents/customer/bff";
import { customerContext, errorResponse, notFound } from "../../_lib/context";

export const dynamic = "force-dynamic";

/** Booking status. An open booking is refreshed with one GetTask to the clinic on every read. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const { id } = await params;
    const view = await bookingView(ctx.deps, ctx.profile.id, id);
    return view ? Response.json(view) : notFound();
  } catch (error) {
    return errorResponse(error);
  }
}
