import { listProxyQueue } from "../../../../lib/agents/clinic/proxy";
import { ensurePlatformReady } from "../../../../lib/bff/demo";

// GET /api/ops/proxy-queue: proxy clinic bookings waiting for the operator (05 /ops/proxy-queue).
export const dynamic = "force-dynamic";

export async function GET() {
  await ensurePlatformReady();
  return Response.json({ bookings: await listProxyQueue() });
}
