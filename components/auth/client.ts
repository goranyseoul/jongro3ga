// Browser helpers for the auth endpoints (track AUTH). Plain fetch, same origin, cookies set by the
// server. Other tracks may use signOut() and fetchMe() from here.
import type { AuthUiCopy } from "./copy";

export type AuthOptions = {
  google: boolean;
  demo: boolean;
  demoAccounts: { key: string; name: string; locale?: string; start?: "onboarding" | "home" }[];
};

export type AuthResult = { ok: true; data: unknown } | { ok: false; code: string; status: number };

async function post(path: string, body: unknown): Promise<AuthResult> {
  try {
    const res = await fetch(`/api/auth${path}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    if (res.ok) return { ok: true, data };
    const code = (data && typeof data === "object" && "code" in data && typeof data.code === "string" && data.code) || `HTTP_${res.status}`;
    return { ok: false, code, status: res.status };
  } catch {
    return { ok: false, code: "NETWORK", status: 0 };
  }
}

export function signUpEmail(email: string, password: string): Promise<AuthResult> {
  return post("/sign-up/email", { email: email.trim(), password, name: "" });
}

export function signInEmail(email: string, password: string): Promise<AuthResult> {
  return post("/sign-in/email", { email: email.trim(), password });
}

export function signOut(): Promise<AuthResult> {
  return post("/sign-out", {});
}

/**
 * Signs out and leaves the signed-in app with a full page load. Use this for sign-out buttons: a
 * signed-out page that stays open keeps prefetching app routes, which proxy.ts now redirects.
 */
export async function signOutAndLeave(locale: string): Promise<void> {
  await signOut();
  window.location.assign(`/${locale}`);
}

/** DEMO_MODE only: signs in as a demo persona ("Yuki", "lin", "operator", ...) without a password. */
export function demoSignIn(persona: string): Promise<AuthResult> {
  return post("/demo/sign-in", { persona });
}

/** Starts Google sign-in; on success the browser leaves for Google. */
export async function signInGoogle(callbackURL: string, newUserCallbackURL?: string): Promise<AuthResult> {
  const result = await post("/sign-in/social", { provider: "google", callbackURL, newUserCallbackURL });
  if (result.ok) {
    const url = (result.data as { url?: unknown } | null)?.url;
    if (typeof url === "string") window.location.assign(url);
  }
  return result;
}

export async function fetchAuthOptions(): Promise<AuthOptions> {
  try {
    const res = await fetch("/api/auth/options", { cache: "no-store" });
    if (res.ok) return (await res.json()) as AuthOptions;
  } catch {
    // fall through
  }
  return { google: false, demo: false, demoAccounts: [] };
}

/** Whether there is a session, without logging an error response when signed out (get-session answers 200 null). */
export async function hasSession(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/get-session", { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return false;
    const body = (await res.json()) as { user?: unknown } | null;
    return Boolean(body?.user);
  } catch {
    return false;
  }
}

/** GET /api/me, or null when signed out. */
export async function fetchMe<T = unknown>(): Promise<T | null> {
  const res = await fetch("/api/me", { cache: "no-store", credentials: "same-origin" });
  return res.ok ? ((await res.json()) as T) : null;
}

export function errorMessage(code: string, status: number, copy: AuthUiCopy): string {
  if (code === "INVALID_EMAIL_OR_PASSWORD") return copy.errors.invalidCredentials;
  if (code.startsWith("USER_ALREADY_EXISTS")) return copy.errors.emailTaken;
  if (code === "PASSWORD_TOO_SHORT") return copy.errors.passwordTooShort;
  if (code === "INVALID_EMAIL") return copy.errors.invalidEmail;
  if (status === 429) return copy.errors.tooMany;
  return copy.errors.unknown;
}

/** A same-origin path from ?next=, or null (never an absolute or protocol-relative URL). */
export function safeNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}
