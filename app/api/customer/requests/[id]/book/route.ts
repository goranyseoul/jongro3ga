import { after } from "next/server";
import { bookQuote, pollBooking } from "@/lib/agents/customer/orchestrator";
import { customerContext, errorResponse, readJson } from "../../../_lib/context";
import { BookSchema } from "../../../_lib/schemas";

export const dynamic = "force-dynamic";

/** Books a chosen quote and slot: clinic.book with returnImmediately, then GetTask polling in the background. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await customerContext(request);
  if (ctx instanceof Response) return ctx;
  try {
    const { id } = await params;
    const body = await readJson(request, BookSchema);
    const booking = await bookQuote(ctx.deps, ctx.profile.id, { requestId: id, quoteId: body.quoteId, slot: body.slot });
    after(() => pollBooking(ctx.deps, ctx.profile.id, booking.id).catch((error) => console.error("[customer] poll failed", error)));
    return Response.json({ bookingId: booking.id, booking }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
