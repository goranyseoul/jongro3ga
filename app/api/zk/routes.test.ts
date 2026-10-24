import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "../../../lib/auth/session";

const session = vi.hoisted(() => ({ user: null as SessionUser | null }));
vi.mock("../../../lib/auth/session", () => ({ getSessionUser: async () => session.user }));
const zk = vi.hoisted(() => ({ calls: [] as string[] }));
vi.mock("../../../lib/zk", async () => {
  const real = await vi.importActual<typeof import("../../../lib/zk")>("../../../lib/zk");
  return {
    ...real,
    matchOffersDetailed: async (id: string) => {
      zk.calls.push(id);
      return [
        { clinicId: "cln_mint", offerId: "ofr_mint_rejuran_first_visit", title: "first", eligible: true },
        { clinicId: "cln_seoul_glow", offerId: "ofr_seoul_glow_rejuran_second", title: "second", eligible: false },
      ];
    },
    ledgerSummary: async (limit: number) => ({ chainId: 84532, registry: "0xcf47", secondsPerDay: 60, records: 1, pseudonyms: 1, latest: [], limit }),
  };
});

import { GET as offers } from "./offers/route";
import { GET as ledger } from "./ledger/route";

const ENV = { ...process.env };
afterEach(() => {
  session.user = null;
  zk.calls.length = 0;
  for (const k of ["ZK_SERVER_URL", "DEMO_MODE"] as const) {
    if (ENV[k] === undefined) delete process.env[k];
    else process.env[k] = ENV[k];
  }
});

const customer = (customerAgentId: string): SessionUser => ({ id: "u1", email: "a@b.c", name: null, customerAgentId, role: "customer" });
const get = (path: string) => new Request(`http://localhost:3507${path}`);

describe("GET /api/zk/offers", () => {
  it("needs a session outside demo mode", async () => {
    delete process.env.DEMO_MODE;
    expect((await offers(get("/api/zk/offers"))).status).toBe(401);
  });

  it("falls back to Yuki in demo mode and returns eligible offers only", async () => {
    process.env.DEMO_MODE = "true";
    process.env.ZK_SERVER_URL = "http://zk.test";
    const res = await offers(get("/api/zk/offers"));
    expect(res.status).toBe(200);
    expect(zk.calls).toEqual(["cag_7f3k2"]);
    expect(await res.json()).toEqual({ status: "ok", offers: [{ clinicId: "cln_mint", offerId: "ofr_mint_rejuran_first_visit", title: "first", eligible: true }] });
  });

  it("uses the signed-in customer agent id", async () => {
    process.env.ZK_SERVER_URL = "http://zk.test";
    session.user = customer("cag_2q9wk");
    await offers(get("/api/zk/offers"));
    expect(zk.calls).toEqual(["cag_2q9wk"]);
  });

  it("answers without calling GlowPass when ZK is off or the customer has no wallet", async () => {
    session.user = customer("cag_7f3k2");
    delete process.env.ZK_SERVER_URL;
    expect(await (await offers(get("/api/zk/offers"))).json()).toEqual({ status: "off", offers: [] });
    process.env.ZK_SERVER_URL = "http://zk.test";
    session.user = customer("cag_8h3tb");
    expect(await (await offers(get("/api/zk/offers"))).json()).toEqual({ status: "no_wallet", offers: [] });
    expect(zk.calls).toEqual([]);
  });

  it("is for customer accounts only", async () => {
    session.user = { ...customer("cag_x"), role: "clinic_staff", clinicId: "cln_mint" };
    expect((await offers(get("/api/zk/offers"))).status).toBe(403);
  });
});

describe("GET /api/zk/ledger", () => {
  it("is off without ZK_SERVER_URL", async () => {
    delete process.env.ZK_SERVER_URL;
    expect(await (await ledger(get("/api/zk/ledger"))).json()).toEqual({ status: "off", ledger: null });
  });

  it("clamps the limit", async () => {
    process.env.ZK_SERVER_URL = "http://zk.test";
    const body = await (await ledger(get("/api/zk/ledger?limit=999"))).json();
    expect(body.status).toBe("ok");
    expect(body.ledger.limit).toBe(50);
  });
});
