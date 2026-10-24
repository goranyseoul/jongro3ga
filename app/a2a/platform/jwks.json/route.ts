import { jwks } from "../../../../lib/a2a/auth";

// Public key set for referral tokens, so a clinic agent hosted elsewhere can verify them (03 "인증과 신뢰").
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(await jwks());
}
