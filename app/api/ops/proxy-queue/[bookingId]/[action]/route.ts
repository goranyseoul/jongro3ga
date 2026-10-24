import { confirmProxyBooking, rejectBooking } from "../../../../../../lib/agents/clinic/booking";
import { inProcessFetch } from "../../../../../../lib/bff/in-process-fetch";

// POST /api/ops/proxy-queue/{bookingId}/confirm | /reject { reason }: the operator's answer after calling the clinic.
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ bookingId: string; action: string }> }) {
  const { bookingId, action } = await ctx.params;
  try {
    if (action === "confirm") return Response.json({ booking: await confirmProxyBooking(bookingId, { fetchImpl: inProcessFetch }) });
    if (action === "reject") {
      const body = (await req.json().catch(() => ({}))) as { reason?: string };
      return Response.json({ booking: await rejectBooking(bookingId, body.reason ?? "clinic_declined") });
    }
    return Response.json({ error: `unknown action ${action}` }, { status: 404 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 409 });
  }
}
