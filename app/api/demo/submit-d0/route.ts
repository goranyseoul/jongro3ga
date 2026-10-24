import { demoEnabled, demoForbidden } from "../../../../lib/bff/demo";
import { submitYukiD0 } from "../../../../lib/bff/demo-scenario";

// POST /api/demo/submit-d0: Yuki's D0 outcome and record anchor for the confirmed booking (10 데모 6행).
export const dynamic = "force-dynamic";

export async function POST() {
  if (!demoEnabled()) return demoForbidden();
  try {
    return Response.json(await submitYukiD0());
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
