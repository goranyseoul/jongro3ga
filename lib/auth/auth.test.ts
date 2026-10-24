import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb } from "../db";
import { getStore, resetStore } from "../store";
import { DEMO_AS_HEADER } from "./config";
import { authHandler, authOptions, deleteMe, getMe, getProfile, putProfile } from "./handlers";
import { getAuth, resetAuth } from "./server";
import { getSessionUser } from "./session";

// PGlite start-up and password hashing are slow when the whole suite runs in parallel
vi.setConfig({ testTimeout: 30_000, hookTimeout: 60_000 });

// Accounts end to end through the real Better Auth handler on an in-memory PGlite database:
// sign up, sign in, sign out, session, demo sign-in, and the /api/me profile API.

const ORIGIN = "http://localhost:3501";
const saved = { ...process.env };

class Browser {
  jar = new Map<string, string>();

  cookieHeader(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  headers(extra?: Record<string, string>): Headers {
    const h = new Headers({ origin: ORIGIN, ...extra });
    if (this.jar.size) h.set("cookie", this.cookieHeader());
    return h;
  }

  absorb(response: Response): Response {
    for (const raw of response.headers.getSetCookie()) {
      const [pair, ...attrs] = raw.split(";");
      const eq = pair.indexOf("=");
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      const expired = attrs.some((a) => /max-age=0\b/i.test(a.trim())) || value === "";
      if (expired) this.jar.delete(name);
      else this.jar.set(name, value);
    }
    return response;
  }

  async auth(path: string, body?: unknown, method = body === undefined ? "GET" : "POST"): Promise<Response> {
    const init: RequestInit = { method, headers: this.headers(body === undefined ? undefined : { "content-type": "application/json" }) };
    if (body !== undefined) init.body = JSON.stringify(body);
    return this.absorb(await authHandler(new Request(`${ORIGIN}/api/auth${path}`, init)));
  }

  request(path: string, method = "GET", body?: unknown): Request {
    const init: RequestInit = { method, headers: this.headers(body === undefined ? undefined : { "content-type": "application/json" }) };
    if (body !== undefined) init.body = JSON.stringify(body);
    return new Request(`${ORIGIN}${path}`, init);
  }
}

function validProfile(overrides: Record<string, unknown> = {}) {
  return {
    locale: "ja",
    nickname: "ゆき",
    nationality: "JP",
    residency: "short_term_visitor",
    ageBand: "25-29",
    trip: { arrival: "2026-11-08", departure: "2026-11-10", stayArea: "sinsa", flightTimeHome: "19:00" },
    skin: { type: "combination", concerns: ["elasticity", "fine_lines"] },
    safety: { pregnantOrBreastfeeding: false, allergies: [] },
    prefs: { budgetKrw: { max: 450000 }, languagesNeeded: ["ja"] },
    contact: { channel: "line", handle: "yuki_test" },
    ...overrides,
  };
}

beforeAll(async () => {
  process.env.PGLITE_DIR = "memory";
  process.env.BETTER_AUTH_SECRET = "test-secret-for-vitest-only-0123456789abcdef";
  delete process.env.DATABASE_URL;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  process.env.DEMO_MODE = "true";
  await closeDb();
  resetAuth();
  await getAuth(); // open, migrate and seed once, outside the per-test timeout
});

afterAll(async () => {
  await closeDb();
  resetAuth();
  process.env = saved;
});

beforeEach(() => {
  process.env.DEMO_MODE = "true";
});

describe("email sign up, session, sign out, sign in", () => {
  it("creates a customer with a fresh cag_ agent id and a session cookie", async () => {
    resetStore();
    const b = new Browser();
    const res = await b.auth("/sign-up/email", { email: "new.user@example.com", password: "correct-horse-1", name: "" });
    expect(res.status).toBe(200);
    expect([...b.jar.keys()].some((k) => k === "pibook.session_token")).toBe(true);

    const user = await getSessionUser(b.headers());
    expect(user).toMatchObject({ email: "new.user@example.com", role: "customer", name: null });
    expect(user!.customerAgentId).toMatch(/^cag_[a-z0-9]{10}$/);

    // the customer namespace binds the account to its agent id
    const record = await getStore().get<{ agentId: string; email: string }>("customer", "accounts", user!.id);
    expect(record).toMatchObject({ agentId: user!.customerAgentId, email: "new.user@example.com" });

    const session = await (await b.auth("/get-session")).json();
    expect(session.user).toMatchObject({ email: "new.user@example.com", role: "customer", customerAgentId: user!.customerAgentId });

    expect((await b.auth("/sign-out", {})).status).toBe(200);
    expect(await getSessionUser(b.headers())).toBeNull();

    const again = new Browser();
    expect((await again.auth("/sign-in/email", { email: "new.user@example.com", password: "wrong-password" })).status).toBe(401);
    expect(await getSessionUser(again.headers())).toBeNull();
    expect((await again.auth("/sign-in/email", { email: "new.user@example.com", password: "correct-horse-1" })).status).toBe(200);
    expect((await getSessionUser(again.headers()))!.customerAgentId).toBe(user!.customerAgentId);
  });

  it("gives every account its own agent id and refuses a duplicate email or short password", async () => {
    const a = new Browser();
    const b = new Browser();
    await a.auth("/sign-up/email", { email: "a.unique@example.com", password: "password-aaaa", name: "" });
    await b.auth("/sign-up/email", { email: "b.unique@example.com", password: "password-bbbb", name: "B" });
    const ua = await getSessionUser(a.headers());
    const ub = await getSessionUser(b.headers());
    expect(ua!.customerAgentId).not.toBe(ub!.customerAgentId);
    expect(ub!.name).toBe("B");

    const dup = await new Browser().auth("/sign-up/email", { email: "a.unique@example.com", password: "password-cccc", name: "" });
    expect(dup.status).toBeGreaterThanOrEqual(400);
    const short = await new Browser().auth("/sign-up/email", { email: "short.pw@example.com", password: "short", name: "" });
    expect(short.status).toBe(400);
  });

  it("ignores a role or agent id smuggled into the sign-up body", async () => {
    const b = new Browser();
    const res = await b.auth("/sign-up/email", {
      email: "sneaky@example.com",
      password: "password-sneaky",
      name: "",
      role: "operator",
      customerAgentId: "cag_chosen",
    });
    // Better Auth rejects input:false fields outright or drops them; either way no operator appears
    const user = await getSessionUser(b.headers());
    if (res.status === 200) {
      expect(user!.role).toBe("customer");
      expect(user!.customerAgentId).not.toBe("cag_chosen");
    } else {
      expect(user).toBeNull();
    }
  });

  it("returns null without a cookie or with a forged one", async () => {
    expect(await getSessionUser(new Headers())).toBeNull();
    expect(await getSessionUser(new Headers({ cookie: "pibook.session_token=forged.value" }))).toBeNull();
  });
});

describe("demo accounts", () => {
  it("signs in a demo persona without a password in DEMO_MODE", async () => {
    const b = new Browser();
    const res = await b.auth("/demo/sign-in", { persona: "Yuki" });
    expect(res.status).toBe(200);
    expect((await res.json()).persona).toEqual({ key: "yuki", locale: "ja", start: "onboarding" });
    expect(await getSessionUser(b.headers())).toEqual({
      id: "cus_yuki",
      email: "yuki.demo@example.com",
      name: "Yuki",
      customerAgentId: "cag_7f3k2",
      role: "customer",
    });

    const jisoo = new Browser();
    expect((await jisoo.auth("/demo/sign-in", { persona: "지수" })).status).toBe(200);
    expect((await getSessionUser(jisoo.headers()))!.customerAgentId).toBe("cag_8h3tb");

    const staff = new Browser();
    expect((await staff.auth("/demo/sign-in", { persona: "seoul_glow_staff" })).status).toBe(200);
    expect(await getSessionUser(staff.headers())).toMatchObject({ role: "clinic_staff", clinicId: "cln_seoul_glow" });

    const op = new Browser();
    expect((await op.auth("/demo/sign-in", { persona: "operator" })).status).toBe(200);
    expect((await getSessionUser(op.headers()))!.role).toBe("operator");

    expect((await new Browser().auth("/demo/sign-in", { persona: "nobody" })).status).toBe(400);
  });

  it("refuses demo sign-in when DEMO_MODE is off", async () => {
    process.env.DEMO_MODE = "false";
    const b = new Browser();
    expect((await b.auth("/demo/sign-in", { persona: "Yuki" })).status).toBe(404);
    expect(await getSessionUser(b.headers())).toBeNull();
  });

  it("falls back to the demo clinic staff or operator only in DEMO_MODE with the proxy marker", async () => {
    expect(await getSessionUser(new Headers({ [DEMO_AS_HEADER]: "clinic_staff" }))).toMatchObject({ role: "clinic_staff", clinicId: "cln_seoul_glow" });
    expect(await getSessionUser(new Headers({ [DEMO_AS_HEADER]: "operator" }))).toMatchObject({ role: "operator", id: "opr_demo" });
    expect(await getSessionUser(new Headers({ [DEMO_AS_HEADER]: "customer" }))).toBeNull();
    process.env.DEMO_MODE = "false";
    expect(await getSessionUser(new Headers({ [DEMO_AS_HEADER]: "operator" }))).toBeNull();
  });

  it("reports sign-in options for the UI", async () => {
    let body = await (await authOptions()).json();
    expect(body).toMatchObject({ google: false, demo: true });
    expect(body.demoAccounts.map((a: { key: string }) => a.key)).toEqual(["yuki", "lin", "emily", "jisoo"]);
    process.env.DEMO_MODE = "false";
    process.env.GOOGLE_CLIENT_ID = "id";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    body = await (await authOptions()).json();
    expect(body).toEqual({ google: true, demo: false, demoAccounts: [] });
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
  });
});

describe("profile API", () => {
  it("requires a session", async () => {
    const b = new Browser();
    expect((await getMe(b.request("/api/me"))).status).toBe(401);
    expect((await putProfile(b.request("/api/me/profile", "PUT", validProfile()))).status).toBe(401);
    expect((await deleteMe(b.request("/api/me", "DELETE"))).status).toBe(401);
  });

  it("PUT validates and stores the profile keyed by the account, GET returns it", async () => {
    resetStore();
    const b = new Browser();
    await b.auth("/sign-up/email", { email: "profile.owner@example.com", password: "password-profile", name: "" });
    const user = (await getSessionUser(b.headers()))!;

    let me = await (await getMe(b.request("/api/me"))).json();
    expect(me.profile).toBeNull();
    expect(me.account).toMatchObject({ id: user.id, email: "profile.owner@example.com", customerAgentId: user.customerAgentId, role: "customer" });

    const bad = await putProfile(b.request("/api/me/profile", "PUT", validProfile({ ageBand: "21" })));
    expect(bad.status).toBe(400);
    expect((await bad.json()).issues[0].path).toEqual(["ageBand"]);
    expect((await putProfile(b.request("/api/me/profile", "PUT", validProfile({ nickName: "typo" })))).status).toBe(400);
    expect(
      (await putProfile(b.request("/api/me/profile", "PUT", validProfile({ trip: { arrival: "2026-11-10", departure: "2026-11-08" } })))).status,
    ).toBe(400);
    expect((await putProfile(b.request("/api/me/profile", "PUT", validProfile({ id: "cus_someone_else" })))).status).toBe(403);
    expect((await putProfile(b.request("/api/me/profile", "PUT", validProfile({ agentId: "cag_notmine" })))).status).toBe(403);

    const ok = await putProfile(b.request("/api/me/profile", "PUT", validProfile()));
    expect(ok.status).toBe(200);
    const saved = (await ok.json()).profile;
    expect(saved).toMatchObject({ id: user.id, agentId: user.customerAgentId, nickname: "ゆき" });
    expect(await getStore().get("customer", "profiles", user.id)).toEqual(saved);

    me = await (await getMe(b.request("/api/me"))).json();
    expect(me.profile).toEqual(saved);
    expect((await (await getProfile(b.request("/api/me/profile"))).json()).profile).toEqual(saved);

    // a KR customer without trip or residency is valid (06: residency is for foreign nationals only)
    const kr = validProfile({ nationality: "KR", residency: undefined, trip: undefined, locale: "ko" });
    expect((await putProfile(b.request("/api/me/profile", "PUT", kr))).status).toBe(200);
  });

  it("DELETE removes the account, its sessions and every customer-namespace item it owns, and nothing else", async () => {
    resetStore();
    const b = new Browser();
    await b.auth("/sign-up/email", { email: "leaving@example.com", password: "password-leaving", name: "" });
    const user = (await getSessionUser(b.headers()))!;
    await putProfile(b.request("/api/me/profile", "PUT", validProfile()));

    const other = new Browser();
    await other.auth("/sign-up/email", { email: "staying@example.com", password: "password-staying", name: "" });
    const stay = (await getSessionUser(other.headers()))!;
    await putProfile(other.request("/api/me/profile", "PUT", validProfile({ nickname: "stay" })));

    const store = getStore();
    await store.put("customer", "consents", { id: "cns_1", customerId: user.id, type: "terms", granted: true });
    await store.put("customer", "records", { id: "trt_1", customerId: user.id, procedureId: "rejuran" });
    await store.put("customer", "requests", { id: "req_1", customerId: user.id });
    await store.put("customer", "quotes", { id: "rq_1", requestId: "req_1" });
    await store.put("customer", "bookings", { id: "bk_1", requestId: "req_1", clinicId: "cln_x" });
    await store.put("customer", "outcomes", { id: "od_1", bookingId: "bk_1" });
    await store.put("customer", "onboarding", { id: "onb_1", agentId: user.customerAgentId });
    await store.put("customer", "requests", { id: "req_2", customerId: stay.id });
    await store.put("customer", "quotes", { id: "rq_2", requestId: "req_2" });
    await store.put("platform", "outcomes", { id: "out_1", customerAgentId: user.customerAgentId });

    const res = await deleteMe(b.request("/api/me", "DELETE"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.deleted).toBe(true);
    expect(body.removed).toEqual({ accounts: 1, profiles: 1, consents: 1, records: 1, requests: 1, quotes: 1, bookings: 1, outcomes: 1, onboarding: 1 });
    expect(res.headers.getSetCookie().some((c) => c.startsWith("pibook.session_token=") && /max-age=0/i.test(c))).toBe(true);

    expect(await getSessionUser(b.headers())).toBeNull();
    expect((await new Browser().auth("/sign-in/email", { email: "leaving@example.com", password: "password-leaving" })).status).toBe(401);
    expect(await store.get("customer", "profiles", user.id)).toBeUndefined();
    expect(await store.list("customer", "quotes")).toEqual([{ id: "rq_2", requestId: "req_2" }]);
    // other namespaces are owned by other agents and are not touched here
    expect(await store.list("platform", "outcomes")).toHaveLength(1);

    // the other customer is untouched
    expect((await getSessionUser(other.headers()))!.id).toBe(stay.id);
    expect(((await store.get("customer", "profiles", stay.id)) as { nickname: string }).nickname).toBe("stay");
  });

  it("does not let the DEMO_MODE fallback user delete or write a profile", async () => {
    const h = { [DEMO_AS_HEADER]: "operator" };
    const req = new Request(`${ORIGIN}/api/me`, { method: "DELETE", headers: { origin: ORIGIN, ...h } });
    expect((await deleteMe(req)).status).toBe(401);
    const put = new Request(`${ORIGIN}/api/me/profile`, { method: "PUT", headers: { origin: ORIGIN, "content-type": "application/json", ...h }, body: JSON.stringify(validProfile()) });
    expect((await putProfile(put)).status).toBe(403);
  });
});
