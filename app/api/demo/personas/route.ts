// GET /api/demo/personas: who the demo can switch to and which screen each one opens (05 demo control).
// Signing a persona in is the auth track's job; this only tells the demo page where each persona starts.
import { demoOnly, json } from "../../ops/_lib/http";
import { DEMO_PERSONA_LIST } from "../_lib/personas";

export const dynamic = "force-dynamic";

export async function GET() {
  return demoOnly() ?? json({ personas: DEMO_PERSONA_LIST });
}
