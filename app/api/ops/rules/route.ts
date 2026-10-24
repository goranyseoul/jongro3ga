import { platformStore } from "../../../../lib/agents/platform/store";
import { ensurePlatformReady } from "../../../../lib/bff/demo";

// GET /api/ops/rules?status=proposed|active|rejected|retired (05 /ops/rules).
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  await ensurePlatformReady();
  const status = new URL(req.url).searchParams.get("status");
  const rules = await platformStore.rules();
  return Response.json({ rules: status ? rules.filter((r) => r.status === status) : rules });
}
