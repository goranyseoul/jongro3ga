import { confirmPendingBooking, demoEnabled, demoForbidden, pendingBookings } from "../../../../lib/bff/demo";

// GET: bookings waiting for confirmation. POST { bookingId? }: confirm it (or the oldest one), proxy as the
// operator and direct as the clinic (05 데모 컨트롤 [예약 확정]).
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ bookings: await pendingBookings() });
}

export async function POST(req: Request) {
  if (!demoEnabled()) return demoForbidden();
  const body = (await req.json().catch(() => ({}))) as { bookingId?: string };
  const result = await confirmPendingBooking(body.bookingId);
  if (!result) return Response.json({ error: "no booking is waiting for confirmation" }, { status: 404 });
  return Response.json(result);
}
