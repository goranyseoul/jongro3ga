// POST /api/ops/proxy-queue/:bookingId/confirm: the operator called the clinic and confirms on its behalf.
import { confirmBooking } from "../../../../../../lib/agents/clinic/booking";
import { getStore } from "../../../../../../lib/store";
import { findBooking, operationModeOf } from "../../../_lib/bookings";
import { errorJson, json, requireOperator } from "../../../_lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ bookingId: string }> }) {
  const auth = await requireOperator(request);
  if (!auth.ok) return auth.response;
  const { bookingId } = await ctx.params;
  const store = getStore();
  const booking = await findBooking(store, bookingId);
  if (!booking) return errorJson(404, "not_found", `예약 ${bookingId}을 찾지 못했어요.`);
  if ((await operationModeOf(store, booking.clinicId)) !== "proxy") {
    return errorJson(409, "not_proxy", "직접 운영 병원의 예약은 병원 요청함에서 확정해요.");
  }
  if (booking.status !== "pending_clinic") return errorJson(409, "not_pending", `이미 처리된 예약이에요 (${booking.status}).`);
  try {
    const result = await confirmBooking(booking.clinicId, booking.id, "pibu_operator");
    return json({ result, operatorId: auth.operatorId });
  } catch (error) {
    return errorJson(502, "confirm_failed", error instanceof Error ? error.message : String(error));
  }
}
