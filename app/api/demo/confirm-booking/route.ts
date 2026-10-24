// POST /api/demo/confirm-booking { bookingId? }: confirms a waiting booking with the right actor, the
// operator for proxy clinics and the clinic's staff for direct ones (05-screens.md, 10 T10). Without a
// bookingId it takes the oldest waiting booking. DEMO_MODE only.
import { confirmBooking } from "../../../../lib/agents/clinic/booking";
import { getStore } from "../../../../lib/store";
import { loadBookingRows } from "../../ops/_lib/bookings";
import { demoOnly, errorJson, json, readJson } from "../../ops/_lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const blocked = demoOnly();
  if (blocked) return blocked;
  const body = await readJson(request);
  const bookingId = typeof body.bookingId === "string" ? body.bookingId : undefined;
  const rows = await loadBookingRows(getStore());
  const row = bookingId ? rows.find((r) => r.bookingId === bookingId) : rows.find((r) => r.status === "pending_clinic");
  if (!row) return errorJson(404, "not_found", bookingId ? `예약 ${bookingId}을 찾지 못했어요.` : "확인을 기다리는 예약이 없어요.");
  if (row.status !== "pending_clinic") return errorJson(409, "not_pending", `이미 처리된 예약이에요 (${row.status}).`);
  const by = row.operationMode === "proxy" ? "pibu_operator" : "clinic_staff";
  try {
    const result = await confirmBooking(row.clinicId, row.bookingId, by);
    return json({ result, bookingId: row.bookingId, clinicId: row.clinicId, operationMode: row.operationMode, confirmedBy: by });
  } catch (error) {
    return errorJson(502, "confirm_failed", error instanceof Error ? error.message : String(error));
  }
}
