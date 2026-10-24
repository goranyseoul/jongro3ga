import { z } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { DEMO_PERSONA_COOKIE, resolveIdentity } from "@/lib/agents/customer/account";
import { bffDeps } from "@/lib/agents/customer/bff";
import { ConsentError } from "@/lib/agents/customer/consent";
import { OrchestratorError, type OrchestratorDeps } from "@/lib/agents/customer/orchestrator";
import type { CustomerProfile } from "@/lib/domain/customer";
import { getStore, type Store } from "@/lib/store";

// Shared plumbing of the customer BFF (09: the UI calls only app/api/customer/*, which calls only the
// customer agent module). The signed-in account comes from the AUTH track; demo mode falls back to Yuki.

export interface CustomerContext {
  store: Store;
  profile: CustomerProfile;
  demo: boolean;
  baseUrl: string;
  deps: OrchestratorDeps;
}

function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export async function customerContext(request: Request): Promise<CustomerContext | Response> {
  const store = getStore();
  const user = await getSessionUser(request.headers);
  const identity = await resolveIdentity(store, user, cookieValue(request.headers.get("cookie"), DEMO_PERSONA_COOKIE));
  if (identity.kind === "signed_out") return Response.json({ error: "signed_out" }, { status: 401 });
  if (identity.kind === "needs_onboarding") return Response.json({ error: "needs_onboarding", agentId: identity.agentId }, { status: 409 });
  const baseUrl = new URL(request.url).origin;
  return { store, profile: identity.profile, demo: identity.demo, baseUrl, deps: bffDeps(baseUrl, store) };
}

const STATUS: Record<OrchestratorError["code"], number> = {
  not_found: 404,
  not_eligible: 403,
  invalid_request: 400,
  invalid_state: 409,
  slot_unavailable: 409,
  consent_required: 403,
  clinic_unavailable: 502,
  already_booked: 409,
};

/** Maps agent errors to HTTP; anything unexpected is a 500 without internals. */
export function errorResponse(error: unknown): Response {
  if (error instanceof OrchestratorError) return Response.json({ error: error.code, message: error.message }, { status: STATUS[error.code] });
  if (error instanceof ConsentError) return Response.json({ error: "consent_required", consent: error.consent, message: error.message }, { status: 403 });
  if (error instanceof z.ZodError) {
    return Response.json({ error: "invalid_request", issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  }
  console.error("[customer bff]", error);
  return Response.json({ error: "internal" }, { status: 500 });
}

export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  return schema.parse(body);
}

export const notFound = () => Response.json({ error: "not_found" }, { status: 404 });
