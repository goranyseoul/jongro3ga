import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { classify, config, proxy } from "../../proxy";
import { closeDb } from "../db";
import { DEMO_AS_HEADER } from "./config";
import { authHandler } from "./handlers";
import { resetAuth } from "./server";

// proxy.ts redirect rules, with real Better Auth cookies (signed cookie cache) from the demo sign-in.

const ORIGIN = "http://localhost:3501";
const saved = { ...process.env };

function req(path: string, cookie?: string, extra?: Record<string, string>): NextRequest {
  const headers = new Headers(extra);
  if (cookie) headers.set("cookie", cookie);
  return new NextRequest(`${ORIGIN}${path}`, { headers });
}

function cookiesOf(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
}

async function demoCookies(persona: string): Promise<string> {
  const res = await authHandler(
    new Request(`${ORIGIN}/api/auth/demo/sign-in`, {
      method: "POST",
      headers: { origin: ORIGIN, "content-type": "application/json" },
      body: JSON.stringify({ persona }),
    }),
  );
  expect(res.status).toBe(200);
  return cookiesOf(res);
}

/** The request header value proxy forwards upstream (NextResponse.next({ request: { headers } })). */
function forwarded(res: Response, name: string): string | null {
  return res.headers.get(`x-middleware-request-${name}`);
}

function isPassThrough(res: Response): boolean {
  return res.headers.get("x-middleware-next") === "1" && !res.headers.get("location");
}

let customer = "";
let staff = "";
let operator = "";

beforeAll(async () => {
  process.env.PGLITE_DIR = "memory";
  process.env.BETTER_AUTH_SECRET = "test-secret-for-vitest-only-0123456789abcdef";
  delete process.env.DATABASE_URL;
  process.env.DEMO_MODE = "true";
  await closeDb();
  resetAuth();
  customer = await demoCookies("Emily");
  staff = await demoCookies("seoul_glow_staff");
  operator = await demoCookies("operator");
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env.DEMO_MODE = "false";
});

afterAll(async () => {
  await closeDb();
  resetAuth();
  process.env = saved;
});

describe("classify", () => {
  it("knows customer app routes, clinic, ops and demo surfaces", () => {
    expect(classify("/ja/home")).toEqual({ kind: "customer", locale: "ja" });
    expect(classify("/zh-CN/requests/req_1")).toEqual({ kind: "customer", locale: "zh-CN" });
    expect(classify("/en/settings/data")).toEqual({ kind: "customer", locale: "en" });
    expect(classify("/clinic/inbox")).toEqual({ kind: "role", role: "clinic_staff", api: false });
    expect(classify("/ops")).toEqual({ kind: "role", role: "operator", api: false });
    expect(classify("/demo")).toEqual({ kind: "role", role: "operator", api: false });
    expect(classify("/api/clinic/tasks")).toEqual({ kind: "role", role: "clinic_staff", api: true });
    expect(classify("/api/demo/reset")).toEqual({ kind: "role", role: "operator", api: true });
    for (const open of ["/", "/en", "/ja/signup", "/ko/login", "/en/onboarding", "/en/legal/patient-rights", "/api/auth/get-session", "/api/me", "/a2a/platform/rpc", "/ui-kit", "/fr/home"]) {
      expect(classify(open)).toBeNull();
    }
  });

  it("runs on every route except build assets", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test("/ja/home")).toBe(true);
    expect(re.test("/api/customer/requests")).toBe(true);
    expect(re.test("/_next/static/chunk.js")).toBe(false);
  });
});

describe("customer app routes", () => {
  it("send signed-out visitors to the landing with the auth dialog and a way back", async () => {
    const res = await proxy(req("/ja/requests/req_1?tab=quotes"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/ja");
    expect(location.searchParams.get("auth")).toBe("login");
    expect(location.searchParams.get("next")).toBe("/ja/requests/req_1?tab=quotes");
  });

  it("redirect in DEMO_MODE too (the demo buttons sign in without a password)", async () => {
    process.env.DEMO_MODE = "true";
    expect((await proxy(req("/en/home"))).status).toBe(307);
  });

  it("let signed-in visitors through", async () => {
    expect(isPassThrough(await proxy(req("/en/home", customer)))).toBe(true);
  });
});

describe("clinic console and ops", () => {
  it("redirect signed-out staff pages to the Korean login and answer 401 on APIs", async () => {
    const page = await proxy(req("/clinic/inbox"));
    expect(page.status).toBe(307);
    const location = new URL(page.headers.get("location")!);
    expect(location.pathname).toBe("/ko/login");
    expect(location.searchParams.get("next")).toBe("/clinic/inbox");
    expect(location.searchParams.get("denied")).toBeNull();

    const api = await proxy(req("/api/ops/proposals"));
    expect(api.status).toBe(401);
  });

  it("allow the matching role from the signed cookie cache", async () => {
    expect(isPassThrough(await proxy(req("/clinic/inbox", staff)))).toBe(true);
    expect(isPassThrough(await proxy(req("/ops", operator)))).toBe(true);
    expect(isPassThrough(await proxy(req("/api/demo/reset", operator)))).toBe(true);
  });

  it("refuse the wrong role: login page with denied=1, or 403 on APIs", async () => {
    const page = await proxy(req("/ops", customer));
    expect(new URL(page.headers.get("location")!).searchParams.get("denied")).toBe("1");
    expect((await proxy(req("/clinic", operator))).status).toBe(307);
    expect((await proxy(req("/api/clinic/tasks", customer))).status).toBe(403);
  });

  it("fall back to the session endpoint when the cookie cache is gone", async () => {
    const tokenOnly = operator
      .split("; ")
      .filter((c) => c.startsWith("pibook.session_token="))
      .join("; ");
    const fetchMock = vi.fn(async () => Response.json({ user: { role: "operator" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(isPassThrough(await proxy(req("/ops", tokenOnly)))).toBe(true);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(`${ORIGIN}/api/auth/get-session`);

    vi.stubGlobal("fetch", vi.fn(async () => Response.json(null)));
    expect((await proxy(req("/ops", tokenOnly))).status).toBe(307);
  });

  it("stay open in DEMO_MODE and mark the request with the demo role", async () => {
    process.env.DEMO_MODE = "true";
    const clinic = await proxy(req("/clinic/inbox"));
    expect(isPassThrough(clinic)).toBe(true);
    expect(forwarded(clinic, DEMO_AS_HEADER)).toBe("clinic_staff");

    const ops = await proxy(req("/api/ops/proposals", customer));
    expect(isPassThrough(ops)).toBe(true);
    expect(forwarded(ops, DEMO_AS_HEADER)).toBe("operator");

    // a real account with the right role is used as is
    const real = await proxy(req("/clinic", staff));
    expect(forwarded(real, DEMO_AS_HEADER)).toBeNull();
  });
});

describe("demo marker header", () => {
  it("is stripped from client requests on every route", async () => {
    process.env.DEMO_MODE = "true";
    const spoof = { [DEMO_AS_HEADER]: "operator" };
    for (const path of ["/api/customer/requests", "/api/me", "/en/home", "/clinic"]) {
      const res = await proxy(req(path, path === "/en/home" ? customer : path === "/clinic" ? staff : undefined, spoof));
      expect(forwarded(res, DEMO_AS_HEADER)).toBeNull();
      expect(res.headers.get("x-middleware-override-headers") ?? "").not.toContain(`${DEMO_AS_HEADER}`);
    }
  });
});
