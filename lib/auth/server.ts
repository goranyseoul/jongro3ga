import { randomInt } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthEndpoint } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { clock } from "../clock";
import { getDb, type Db } from "../db";
import { schema, user as userTable } from "../db/schema";
import type { CustomerAccount } from "../domain/customer";
import { getStore } from "../store";
import { COOKIE_PREFIX, authBaseUrl, authSecret, googleEnabled, isDemoMode, useSecureCookies } from "./config";
import { DEMO_ACCOUNTS, findDemoAccount, type DemoAccount } from "./demo";
import type { SessionUser } from "./session";

// Better Auth instance (track AUTH). Email + password, optional Google, session cookie with a short
// signed cookie cache (proxy.ts reads it without touching the database), and the DEMO_MODE-only
// passwordless demo sign-in at POST /api/auth/demo/sign-in.

const AGENT_ID_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/** Pseudonymous customer agent id, "cag_" + 10 random characters (matches ^cag_[A-Za-z0-9_]+$). */
export function newCustomerAgentId(): string {
  let out = "cag_";
  for (let i = 0; i < 10; i++) out += AGENT_ID_ALPHABET[randomInt(AGENT_ID_ALPHABET.length)];
  return out;
}

/** Writes the customer-namespace account record that binds the account to its agent id (06 CustomerAccount). */
export async function putCustomerAccount(account: { id: string; email?: string; agentId: string; demoPersona?: string }): Promise<void> {
  const store = getStore();
  const existing = await store.get<CustomerAccount>("customer", "accounts", account.id);
  const record: CustomerAccount = {
    id: account.id,
    agentId: account.agentId,
    createdAt: existing?.createdAt ?? clock.nowIso(),
    ...(account.email ? { email: account.email } : {}),
    ...(account.demoPersona ? { demoPersona: account.demoPersona } : {}),
  };
  await store.put("customer", "accounts", record);
}

/** Inserts the demo accounts that are missing (by id or email). Idempotent. */
export async function seedDemoAccounts(db: Db, accounts: readonly DemoAccount[] = DEMO_ACCOUNTS): Promise<void> {
  for (const account of accounts) {
    await db
      .insert(userTable)
      .values({
        id: account.id,
        name: account.name,
        email: account.email,
        emailVerified: true,
        role: account.role,
        customerAgentId: account.customerAgentId,
        clinicId: account.clinicId ?? null,
        demoPersona: account.key,
      })
      .onConflictDoNothing();
  }
}

const demoSignInBody = z.object({ persona: z.string().min(1).max(64) });

function demoSignInPlugin() {
  return {
    id: "pibook-demo-sign-in",
    endpoints: {
      demoSignIn: createAuthEndpoint("/demo/sign-in", { method: "POST", body: demoSignInBody }, async (ctx) => {
        if (!isDemoMode()) throw new APIError("NOT_FOUND", { message: "demo sign-in is only available when DEMO_MODE=true" });
        const account = findDemoAccount(ctx.body.persona);
        if (!account) throw new APIError("BAD_REQUEST", { message: `unknown demo persona: ${ctx.body.persona}` });
        await seedDemoAccounts(await getDb(), [account]);
        const found = await ctx.context.internalAdapter.findUserById(account.id);
        if (!found) throw new APIError("INTERNAL_SERVER_ERROR", { message: "demo account could not be created" });
        if (account.role === "customer") {
          await putCustomerAccount({ id: account.id, email: account.email, agentId: account.customerAgentId, demoPersona: account.key });
        }
        const session = await ctx.context.internalAdapter.createSession(found.id);
        await setSessionCookie(ctx, { session, user: found });
        return ctx.json({
          user: { id: found.id, email: found.email, name: found.name, role: account.role },
          persona: { key: account.key, locale: account.locale ?? null, start: account.start ?? null },
        });
      }),
    },
  } as const;
}

function createAuth(db: Db) {
  const google = googleEnabled()
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }
    : undefined;

  return betterAuth({
    appName: "PibooK",
    baseURL: authBaseUrl(),
    secret: authSecret(),
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: true, minPasswordLength: 8, maxPasswordLength: 128, autoSignIn: true },
    socialProviders: google,
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "customer", input: false },
        customerAgentId: { type: "string", required: false, input: false },
        clinicId: { type: "string", required: false, input: false },
        demoPersona: { type: "string", required: false, input: false },
      },
    },
    session: {
      // signed copy of { session, user } in a cookie for 5 minutes: proxy.ts checks roles from it
      cookieCache: { enabled: true, maxAge: 5 * 60, strategy: "compact" },
    },
    advanced: { cookiePrefix: COOKIE_PREFIX, useSecureCookies: useSecureCookies() },
    telemetry: { enabled: false },
    databaseHooks: {
      user: {
        create: {
          // every self-service account (email or Google) is a customer with a fresh pseudonymous agent id;
          // clinic staff and operators are provisioned directly in the database
          before: async (data) => ({
            data: { ...data, role: "customer", customerAgentId: newCustomerAgentId(), clinicId: null, demoPersona: null },
          }),
          after: async (created) => {
            await putCustomerAccount({ id: created.id, email: created.email, agentId: String(created.customerAgentId) });
          },
        },
      },
    },
    plugins: [demoSignInPlugin()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

interface AuthGlobals {
  auth?: Promise<Auth>;
}

declare global {
  var __pibookAuth: AuthGlobals | undefined;
}

/** The process-wide Better Auth instance over the migrated database (demo accounts seeded in DEMO_MODE). */
export function getAuth(): Promise<Auth> {
  const g = (globalThis.__pibookAuth ??= {});
  if (!g.auth) {
    const pending = (async () => {
      const db = await getDb();
      if (isDemoMode()) await seedDemoAccounts(db);
      return createAuth(db);
    })();
    pending.catch(() => {
      if (g.auth === pending) g.auth = undefined;
    });
    g.auth = pending;
  }
  return g.auth;
}

/** Forgets the auth instance (tests switch databases or env between suites). */
export function resetAuth(): void {
  const g = (globalThis.__pibookAuth ??= {});
  g.auth = undefined;
}

const ROLES = new Set<SessionUser["role"]>(["customer", "clinic_staff", "operator"]);

/** Maps a Better Auth user (with our additional fields) to the SessionUser contract. */
export function toSessionUser(raw: Record<string, unknown>): SessionUser {
  const role = ROLES.has(raw.role as SessionUser["role"]) ? (raw.role as SessionUser["role"]) : "customer";
  const name = typeof raw.name === "string" && raw.name.trim() !== "" ? raw.name : null;
  const clinicId = typeof raw.clinicId === "string" && raw.clinicId !== "" ? raw.clinicId : undefined;
  return {
    id: String(raw.id),
    email: String(raw.email),
    name,
    customerAgentId: String(raw.customerAgentId ?? ""),
    role,
    ...(clinicId ? { clinicId } : {}),
  };
}

/** The signed-in account from real auth only (no DEMO_MODE fallback). */
export async function getAuthenticatedUser(headers: Headers): Promise<SessionUser | null> {
  const auth = await getAuth();
  // the cookie cache only steers proxy.ts; server code checks the database so a deleted account or a
  // revoked session stops working at once, not when the 5 minute cache runs out
  const result = await auth.api.getSession({ headers, query: { disableCookieCache: true } });
  return result ? toSessionUser(result.user as unknown as Record<string, unknown>) : null;
}
