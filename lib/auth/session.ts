// Current signed-in account for server code (route handlers, server components). OWNER: track AUTH.
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

/** Returns null when signed out. Stub returns null until the auth track lands. */
export async function getSessionUser(_headers?: Headers): Promise<SessionUser | null> {
  return null;
}
