// Environment-derived auth settings. No database or Better Auth imports here: proxy.ts reads this
// module and must stay light (Next 16 runs proxy separately from route code).

export const COOKIE_PREFIX = "pibook";

/** Header proxy.ts sets (and strips from clients) to let DEMO_MODE fall back to a demo account. */
export const DEMO_AS_HEADER = "x-pibook-demo-as";

// Dev-only fallback, used only when DEMO_MODE=true or outside production. Never a real secret.
const DEV_ONLY_SECRET = "pibook-dev-only-secret-not-for-production-0000000000";

export function isDemoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

let warned = false;

/** BETTER_AUTH_SECRET from the environment, or the dev-only fallback in demo mode / development. */
export function authSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (isDemoMode() || process.env.NODE_ENV !== "production") {
    if (!warned) {
      warned = true;
      console.warn("[auth] BETTER_AUTH_SECRET is not set: using the dev-only fallback secret (DEMO_MODE or development only)");
    }
    return DEV_ONLY_SECRET;
  }
  throw new Error("BETTER_AUTH_SECRET is required in production when DEMO_MODE is not true");
}

/** Explicit public origin for auth callbacks. Unset means "infer from each request". */
export function authBaseUrl(): string | undefined {
  return process.env.BETTER_AUTH_URL || undefined;
}

/** Secure (__Secure- prefixed) cookies on https deployments; plain cookies on http://localhost. */
export function useSecureCookies(): boolean {
  const base = authBaseUrl();
  if (base) return base.startsWith("https://");
  return Boolean(process.env.VERCEL);
}

export function googleEnabled(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}
