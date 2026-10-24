import { getDb } from "../db";
import { user as userTable } from "../db/schema";
import { eq } from "drizzle-orm";
import { getStore } from "../store";
import { googleEnabled, isDemoMode } from "./config";
import { DEMO_ACCOUNTS } from "./demo";
import { parseProfileBody, readProfile, writeProfile, ACCOUNT_COLLECTION } from "./profile";
import { purgeCustomerData } from "./purge";
import { getAuth, getAuthenticatedUser } from "./server";
import { getSessionUser } from "./session";
import type { CustomerAccount } from "../domain/customer";

// Route handler bodies for app/api/auth/** and app/api/me/** (the app/ files only re-export these, so
// tests can call them without the Next alias setup). All responses are JSON and never cached.

const NO_STORE = { "cache-control": "no-store" };

function json(body: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set("content-type", "application/json");
  for (const [k, v] of Object.entries(NO_STORE)) headers.set(k, v);
  return new Response(JSON.stringify(body), { status, headers });
}

/** /api/auth/* (Better Auth: sign-up/email, sign-in/email, sign-in/social, sign-out, get-session, callback/google, demo/sign-in). */
export async function authHandler(request: Request): Promise<Response> {
  const auth = await getAuth();
  return auth.handler(request);
}

/** GET /api/auth/options: what the sign-in UI may show. */
export async function authOptions(): Promise<Response> {
  const demo = isDemoMode();
  return json({
    google: googleEnabled(),
    demo,
    demoAccounts: demo
      ? DEMO_ACCOUNTS.filter((a) => a.role === "customer").map((a) => ({ key: a.key, name: a.name, locale: a.locale, start: a.start }))
      : [],
  });
}

/** GET /api/me: { account, profile }. 401 when signed out. */
export async function getMe(request: Request): Promise<Response> {
  const user = await getSessionUser(request.headers);
  if (!user) return json({ error: "unauthorized" }, 401);
  const store = getStore();
  const [profile, record] = await Promise.all([
    readProfile(store, user.id),
    store.get<CustomerAccount>("customer", ACCOUNT_COLLECTION, user.id),
  ]);
  return json({
    account: { ...user, createdAt: record?.createdAt ?? null },
    profile,
  });
}

/** GET /api/me/profile: { profile } (null before onboarding). */
export async function getProfile(request: Request): Promise<Response> {
  const user = await getSessionUser(request.headers);
  if (!user) return json({ error: "unauthorized" }, 401);
  return json({ profile: await readProfile(getStore(), user.id) });
}

/** PUT /api/me/profile: body = CustomerProfile (06). Replaces the stored profile. */
export async function putProfile(request: Request): Promise<Response> {
  const user = await getSessionUser(request.headers);
  if (!user) return json({ error: "unauthorized" }, 401);
  if (user.role !== "customer") return json({ error: "customers_only" }, 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const parsed = parseProfileBody(body, user);
  if (!parsed.ok) return json({ error: parsed.error, issues: parsed.issues }, parsed.status);
  await writeProfile(getStore(), parsed.profile);
  return json({ profile: parsed.profile });
}

/**
 * DELETE /api/me: deletes the account (user, sessions, linked logins) and every customer-namespace
 * item it owns (lib/auth/purge.ts), then expires the session cookies. Real sessions only: the
 * DEMO_MODE clinic/ops fallback user cannot delete anything.
 */
export async function deleteMe(request: Request): Promise<Response> {
  const user = await getAuthenticatedUser(request.headers);
  if (!user) return json({ error: "unauthorized" }, 401);

  const auth = await getAuth();
  const signOut = await auth.api.signOut({ headers: request.headers, asResponse: true });
  const { removed } = await purgeCustomerData(getStore(), { accountId: user.id, agentId: user.customerAgentId });
  const db = await getDb();
  await db.delete(userTable).where(eq(userTable.id, user.id)); // sessions and accounts cascade

  const headers = new Headers();
  for (const cookie of signOut.headers.getSetCookie()) headers.append("set-cookie", cookie);
  return json({ deleted: true, removed }, 200, headers);
}
