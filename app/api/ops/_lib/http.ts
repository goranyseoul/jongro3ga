// Shared helpers for the ops and demo route handlers. Relative imports: vitest has no "@/" alias here.
import { getSessionUser } from "../../../../lib/auth/session";

export function demoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function errorJson(status: number, code: string, message: string, extra: Record<string, unknown> = {}): Response {
  return json({ error: { code, message, ...extra } }, status);
}

export type OperatorCheck = { ok: true; operatorId: string } | { ok: false; response: Response };

/**
 * Ops access: a signed-in operator (getSessionUser role "operator"). In DEMO_MODE the console also opens
 * without one, because the demo page signs customer personas in inside an iframe that shares the same
 * cookies; the action is then attributed to "demo_operator".
 */
export async function requireOperator(request: Request): Promise<OperatorCheck> {
  const user = await getSessionUser(request.headers);
  if (user?.role === "operator") return { ok: true, operatorId: user.id };
  if (demoMode()) return { ok: true, operatorId: "demo_operator" };
  if (!user) return { ok: false, response: errorJson(401, "unauthenticated", "운영자 로그인이 필요해요.") };
  return { ok: false, response: errorJson(403, "forbidden", "운영자 계정만 쓸 수 있어요.") };
}

/** Demo endpoints exist only with DEMO_MODE=true (09-architecture.md); otherwise they are a plain 404. */
export function demoOnly(): Response | null {
  return demoMode() ? null : errorJson(404, "not_found", "Not found");
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
