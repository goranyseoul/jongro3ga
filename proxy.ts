import { NextResponse, type NextRequest } from "next/server";
import { getCookieCache, getSessionCookie } from "better-auth/cookies";
import { COOKIE_PREFIX, DEMO_AS_HEADER, authSecret, isDemoMode, useSecureCookies } from "./lib/auth/config";

// Route guard (Next 16 "proxy", formerly middleware). It never opens the database: proxy runs apart
// from route code, so it decides from cookies only and route handlers re-check with getSessionUser().
//
// - Customer app routes (/{locale}/home|chat|requests|bookings|records|outcomes|settings/**):
//   no session cookie -> the landing with the auth dialog open (?auth=login&next=...).
// - Clinic console (/clinic/**, /api/clinic/**) needs role clinic_staff; ops and demo control
//   (/ops/**, /demo/**, /api/ops/**, /api/demo/**) need role operator. Pages redirect to /ko/login,
//   APIs answer 401/403. With DEMO_MODE=true they stay open: the request is marked with
//   x-pibook-demo-as and getSessionUser() returns the demo clinic staff or operator.
// - The marker header is always stripped from incoming requests, so clients cannot set it.

const LOCALES = ["ja", "zh-CN", "en", "ko"];
const CUSTOMER_SECTIONS = ["home", "chat", "requests", "bookings", "records", "outcomes", "settings"];
const STAFF_LOGIN_LOCALE = "ko";

type Role = "clinic_staff" | "operator";
type Rule = { kind: "customer"; locale: string } | { kind: "role"; role: Role; api: boolean };

export function classify(pathname: string): Rule | null {
  const parts = pathname.split("/").filter(Boolean);
  const [first, second] = parts;
  if (first && LOCALES.includes(first) && second && CUSTOMER_SECTIONS.includes(second)) return { kind: "customer", locale: first };
  if (first === "clinic") return { kind: "role", role: "clinic_staff", api: false };
  if (first === "ops" || first === "demo") return { kind: "role", role: "operator", api: false };
  if (first === "api" && second === "clinic") return { kind: "role", role: "clinic_staff", api: true };
  if (first === "api" && (second === "ops" || second === "demo")) return { kind: "role", role: "operator", api: true };
  return null;
}

async function cookieRole(request: NextRequest): Promise<string | null> {
  // 1. signed cookie cache written by Better Auth (5 minutes), no network
  try {
    const cached = await getCookieCache(request, {
      cookiePrefix: COOKIE_PREFIX,
      isSecure: useSecureCookies(),
      secret: authSecret(),
      strategy: "compact",
    });
    const role = (cached?.user as { role?: unknown } | undefined)?.role;
    if (typeof role === "string") return role;
  } catch {
    // unreadable cache: fall through to the session endpoint
  }
  // 2. cache expired: ask the auth route, which owns the database
  try {
    const res = await fetch(new URL("/api/auth/get-session", request.nextUrl.origin), {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { user?: { role?: unknown } } | null;
    return typeof body?.user?.role === "string" ? body.user.role : null;
  } catch {
    return null;
  }
}

function withoutMarker(request: NextRequest, demoAs?: Role): NextResponse {
  if (!demoAs && !request.headers.has(DEMO_AS_HEADER)) return NextResponse.next();
  const headers = new Headers(request.headers);
  headers.delete(DEMO_AS_HEADER);
  if (demoAs) headers.set(DEMO_AS_HEADER, demoAs);
  return NextResponse.next({ request: { headers } });
}

function nextParam(request: NextRequest): string {
  return request.nextUrl.pathname + request.nextUrl.search;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const rule = classify(request.nextUrl.pathname);
  if (!rule) return withoutMarker(request);

  const hasSession = Boolean(getSessionCookie(request, { cookiePrefix: COOKIE_PREFIX }));

  if (rule.kind === "customer") {
    if (hasSession) return withoutMarker(request);
    const url = new URL(`/${rule.locale}`, request.url);
    url.searchParams.set("auth", "login");
    url.searchParams.set("next", nextParam(request));
    return NextResponse.redirect(url);
  }

  const role = hasSession ? await cookieRole(request) : null;
  if (role === rule.role) return withoutMarker(request);
  if (isDemoMode()) return withoutMarker(request, rule.role);

  if (rule.api) {
    return NextResponse.json(role ? { error: "forbidden" } : { error: "unauthorized" }, { status: role ? 403 : 401 });
  }
  const url = new URL(`/${STAFF_LOGIN_LOCALE}/login`, request.url);
  url.searchParams.set("next", nextParam(request));
  if (role) url.searchParams.set("denied", "1");
  return NextResponse.redirect(url);
}

export const config = {
  // everything except build assets, so the demo marker header is stripped on every route
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
