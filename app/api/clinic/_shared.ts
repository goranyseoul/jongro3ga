// Shared plumbing for the clinic console BFF (app/api/clinic/**). Not a route: no route.ts in this file name.
import { ConsoleError, consoleClinicId } from "@/lib/agents/clinic/console";

/** Runs `fn` for the signed-in clinic (DEMO_MODE falls back to the demo clinic when signed out). */
export async function withClinic(request: Request, fn: (clinicId: string) => Promise<unknown>): Promise<Response> {
  try {
    const clinicId = await consoleClinicId(request.headers);
    if (!clinicId) return Response.json({ error: "병원 계정으로 로그인해 주세요" }, { status: 401 });
    return Response.json(await fn(clinicId), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof ConsoleError) return Response.json({ error: error.message }, { status: error.status });
    console.error("clinic console api", error);
    return Response.json({ error: "처리하지 못했어요. 잠시 후 다시 시도해 주세요" }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new ConsoleError("JSON 본문이 필요해요", 400);
}

/** PUBLIC_BASE_URL when set, otherwise the origin the request came in on. */
export function baseUrlOf(request: Request): string {
  return (process.env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/$/, "");
}
