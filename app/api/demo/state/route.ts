// GET /api/demo/state: what the demo console shows besides the log: clock, injected burst, waiting bookings.
import { clock } from "../../../../lib/clock";
import { getStore } from "../../../../lib/store";
import { countInjected } from "../../../../lib/agents/platform/signals-demo";
import { listRules } from "../../../../lib/agents/platform/proposer-rules";
import { loadBookingRows } from "../../ops/_lib/bookings";
import { demoOnly, json } from "../../ops/_lib/http";
import { procedureName } from "../../ops/_lib/labels";

export const dynamic = "force-dynamic";

export async function GET() {
  const blocked = demoOnly();
  if (blocked) return blocked;
  const store = getStore();
  const bookings = (await loadBookingRows(store)).map((row) => ({ ...row, procedureName: procedureName(row.quote?.procedureId) }));
  return json({
    now: clock.nowIso(),
    today: clock.today(),
    injected: await countInjected(store),
    proposedRules: (await listRules(store, "proposed")).length,
    bookings,
  });
}
