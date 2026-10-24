// Current signed-in account for server code (route handlers, server components). OWNER: track AUTH.
import { DEMO_AS_HEADER, isDemoMode } from "./config";

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  /** Pseudonymous customer agent id bound to this account ("cag_..."), created at signup. */
  customerAgentId: string;
  role: "customer" | "clinic_staff" | "operator";
  /** For clinic_staff: the clinic id they manage. */
  clinicId?: string;
}

async function requestHeaders(): Promise<Headers | null> {
  try {
    const { headers } = await import("next/headers");
    return new Headers(await headers());
  } catch {
    // called outside a request (scripts, tests without headers)
    return null;
  }
}

/**
 * Returns null when signed out.
 * - `headers` defaults to the current request's headers (next/headers) in route handlers and server components.
 * - DEMO_MODE=true: on the clinic console and ops/demo routes proxy.ts marks requests that lack a session
 *   with the right role, and this returns the demo clinic_staff (cln_seoul_glow) or operator account.
 */
export async function getSessionUser(headers?: Headers): Promise<SessionUser | null> {
  const h = headers ?? (await requestHeaders());
  if (!h) return null;

  if (isDemoMode()) {
    const demoAs = h.get(DEMO_AS_HEADER);
    if (demoAs === "clinic_staff" || demoAs === "operator") {
      const { demoAccountForRole, demoSessionUser } = await import("./demo");
      return demoSessionUser(demoAccountForRole(demoAs));
    }
  }

  const { getAuthenticatedUser } = await import("./server");
  return getAuthenticatedUser(h);
}
