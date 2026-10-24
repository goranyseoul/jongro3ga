// GET /api/ops/proxy-queue: booking requests to proxy clinics (05-screens.md /ops/proxy-queue).
import { clock } from "../../../../lib/clock";
import { getStore } from "../../../../lib/store";
import { loadBookingRows } from "../_lib/bookings";
import { json, requireOperator } from "../_lib/http";
import { procedureName } from "../_lib/labels";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireOperator(request);
  if (!auth.ok) return auth.response;
  const rows = (await loadBookingRows(getStore()))
    .filter((row) => row.operationMode === "proxy")
    .map((row) => ({ ...row, procedureName: procedureName(row.quote?.procedureId) }));
  return json({
    now: clock.nowIso(),
    waiting: rows.filter((row) => row.status === "pending_clinic"),
    done: rows.filter((row) => row.status !== "pending_clinic"),
  });
}
