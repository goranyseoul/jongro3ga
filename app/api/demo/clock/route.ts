import { clock, setClock } from "../../../../lib/clock";
import { demoEnabled, demoForbidden } from "../../../../lib/bff/demo";

// GET|POST /api/demo/clock: read or move the fixed demo clock (05 데모 컨트롤 [시계 이동]).
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ now: clock.nowIso() });
}

export async function POST(req: Request) {
  if (!demoEnabled()) return demoForbidden();
  const body = (await req.json().catch(() => ({}))) as { to?: unknown };
  if (typeof body.to !== "string" || Number.isNaN(Date.parse(body.to))) {
    return Response.json({ error: "body.to must be an ISO time" }, { status: 400 });
  }
  setClock(body.to);
  return Response.json({ now: clock.nowIso() });
}
