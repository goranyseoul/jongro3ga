// GET /a2a/platform/jwks.json: public key for referral tokens (ES256), so clinics can verify them anywhere.
import { referralJwks } from "../../../../lib/a2a/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await referralJwks(), { headers: { "Cache-Control": "public, max-age=300" } });
}
