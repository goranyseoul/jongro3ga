// GET/POST /api/demo/clock: read or move the fixed demo clock (06-data-model.md "시계"). DEMO_MODE only.
import { IsoDateTimeSchema } from "../../../../lib/a2a/schemas";
import { clock, resetClock, setClock } from "../../../../lib/clock";
import { demoOnly, errorJson, json, readJson } from "../../ops/_lib/http";

export const dynamic = "force-dynamic";

const state = () => ({ now: clock.nowIso(), today: clock.today() });

export async function GET() {
  return demoOnly() ?? json(state());
}

export async function POST(request: Request) {
  const blocked = demoOnly();
  if (blocked) return blocked;
  const body = await readJson(request);
  if (body.reset === true) {
    resetClock();
    return json(state());
  }
  const parsed = IsoDateTimeSchema.safeParse(body.to);
  if (!parsed.success) return errorJson(400, "bad_time", 'body.to must be an ISO 8601 time with offset, e.g. "2026-11-14T13:00:00+09:00"');
  setClock(parsed.data);
  return json(state());
}
