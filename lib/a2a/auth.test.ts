import { SignJWT, decodeJwt, decodeProtectedHeader, generateKeyPair } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceClockHours, resetClock, setClock } from "../clock";
import { resetStore } from "../store";
import {
  ISSUER,
  clinicSlugFromId,
  getAgentIdentity,
  issueAgentToken,
  issueReferralToken,
  jwks,
  registerAgent,
  verifyAgentToken,
  verifyReferralToken,
} from "./auth";

const T0 = "2026-11-12T10:00:00+09:00";
const referral = { clinicId: "cln_mint", customerAgentId: "cag_7f3k2", requestId: "req_01J9Z8", matchId: "mt_4401" };

beforeEach(() => {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("PUBLIC_BASE_URL", "https://pibu.example");
  setClock(T0);
  resetStore();
});

afterEach(() => {
  resetClock();
  vi.unstubAllEnvs();
});

/** Flips one character in the middle of a JWT part so the signature no longer matches. */
function tamper(token: string, part: 0 | 1 | 2): string {
  const pieces = token.split(".");
  const target = pieces[part];
  const i = Math.floor(target.length / 2);
  pieces[part] = target.slice(0, i) + (target[i] === "A" ? "B" : "A") + target.slice(i + 1);
  return pieces.join(".");
}

describe("agent token", () => {
  it("round trips agent id and role with the 03 claims", async () => {
    const token = await issueAgentToken({ agentId: "cag_7f3k2", role: "customer" });
    expect(await verifyAgentToken(`Bearer ${token}`)).toEqual({ agentId: "cag_7f3k2", role: "customer" });

    const claims = decodeJwt(token);
    expect(claims).toMatchObject({ iss: ISSUER, sub: "cag_7f3k2", role: "customer" });
    expect(claims.exp! - claims.iat!).toBe(7 * 24 * 3600);
    expect(claims.iat).toBe(Date.parse(T0) / 1000);
    expect(decodeProtectedHeader(token).alg).toBe("HS256");
  });

  it("returns null without a header, with a non bearer header, or with a tampered token", async () => {
    const token = await issueAgentToken({ agentId: "cln_mint", role: "clinic" });
    expect(await verifyAgentToken(null)).toBeNull();
    expect(await verifyAgentToken(undefined)).toBeNull();
    expect(await verifyAgentToken("")).toBeNull();
    expect(await verifyAgentToken(token)).toBeNull();
    expect(await verifyAgentToken(`Basic ${token}`)).toBeNull();
    expect(await verifyAgentToken(`Bearer ${tamper(token, 1)}`)).toBeNull();
    expect(await verifyAgentToken(`Bearer ${tamper(token, 2)}`)).toBeNull();
  });

  it("rejects a token signed with another secret or carrying an unknown role", async () => {
    const forged = await new SignJWT({ role: "customer" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(ISSUER)
      .setSubject("cag_x")
      .setIssuedAt(Date.parse(T0) / 1000)
      .setExpirationTime(Date.parse(T0) / 1000 + 60)
      .sign(new TextEncoder().encode("another-secret-another-secret-32"));
    expect(await verifyAgentToken(`Bearer ${forged}`)).toBeNull();

    vi.stubEnv("A2A_TOKEN_SECRET", "test-secret-test-secret-test-sec");
    const adminToken = await new SignJWT({ role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(ISSUER)
      .setSubject("cag_x")
      .setIssuedAt(Date.parse(T0) / 1000)
      .setExpirationTime(Date.parse(T0) / 1000 + 60)
      .sign(new TextEncoder().encode("test-secret-test-secret-test-sec"));
    expect(await verifyAgentToken(`Bearer ${adminToken}`)).toBeNull();

    // A2A_TOKEN_SECRET is the shared secret: a token signed elsewhere with it is accepted.
    const external = await new SignJWT({ role: "clinic" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuer(ISSUER)
      .setSubject("cln_mint")
      .setIssuedAt(Date.parse(T0) / 1000)
      .setExpirationTime(Date.parse(T0) / 1000 + 60)
      .sign(new TextEncoder().encode("test-secret-test-secret-test-sec"));
    expect(await verifyAgentToken(`Bearer ${external}`)).toEqual({ agentId: "cln_mint", role: "clinic" });
  });

  it("expires after 7 days of demo clock", async () => {
    const token = await issueAgentToken({ agentId: "cag_7f3k2", role: "customer" });
    advanceClockHours(7 * 24 - 1);
    expect(await verifyAgentToken(`Bearer ${token}`)).not.toBeNull();
    advanceClockHours(1);
    expect(await verifyAgentToken(`Bearer ${token}`)).toBeNull();
  });
});

describe("referral token", () => {
  it("carries the 03 claims and verifies for its clinic", async () => {
    const token = await issueReferralToken(referral);
    const header = decodeProtectedHeader(token);
    expect(header.alg).toBe("ES256");

    const claims = await verifyReferralToken(token, { clinicId: "cln_mint" });
    expect(claims).toMatchObject({
      iss: ISSUER,
      aud: "cln_mint",
      sub: "cag_7f3k2",
      rid: "req_01J9Z8",
      mid: "mt_4401",
      scope: ["quote", "book"],
    });
    if ("error" in claims) throw new Error("expected claims");
    expect(claims.jti).toMatch(/[0-9a-f-]{36}/);
    expect(claims.exp - claims.iat).toBe(72 * 3600);

    const set = await jwks();
    expect(set.keys).toHaveLength(1);
    expect(set.keys[0]).toMatchObject({ kty: "EC", crv: "P-256", alg: "ES256", use: "sig", kid: header.kid });
    expect(set.keys[0]).not.toHaveProperty("d");
  });

  it("gives every token its own jti", async () => {
    const a = await verifyReferralToken(await issueReferralToken(referral), { clinicId: "cln_mint" });
    const b = await verifyReferralToken(await issueReferralToken(referral), { clinicId: "cln_mint" });
    expect("jti" in a && "jti" in b && a.jti !== b.jti).toBe(true);
  });

  it("is rejected for another clinic", async () => {
    const token = await issueReferralToken(referral);
    expect(await verifyReferralToken(token, { clinicId: "cln_ara" })).toEqual({ error: "wrong_audience" });
  });

  it("expires exactly 72 hours after issue on the demo clock", async () => {
    const token = await issueReferralToken(referral);
    setClock(new Date(Date.parse(T0) + 72 * 3600 * 1000 - 1000));
    expect(await verifyReferralToken(token, { clinicId: "cln_mint" })).toHaveProperty("jti");
    setClock(new Date(Date.parse(T0) + 72 * 3600 * 1000));
    expect(await verifyReferralToken(token, { clinicId: "cln_mint" })).toEqual({ error: "expired" });
  });

  it("rejects tampered payloads and foreign keys as invalid signatures", async () => {
    const token = await issueReferralToken(referral);
    // Swap the payload for one naming another clinic, keeping the original signature.
    const [head, , sig] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ ...decodeJwt(token), aud: "cln_ara" })).toString("base64url");
    expect(await verifyReferralToken(`${head}.${forgedPayload}.${sig}`, { clinicId: "cln_ara" })).toEqual({
      error: "invalid_signature",
    });
    expect(await verifyReferralToken(tamper(token, 2), { clinicId: "cln_mint" })).toEqual({ error: "invalid_signature" });

    const { privateKey } = await generateKeyPair("ES256");
    const foreign = await new SignJWT({ rid: "req_x", mid: "mt_x", scope: ["quote"] })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer(ISSUER)
      .setAudience("cln_mint")
      .setSubject("cag_x")
      .setJti("j")
      .setIssuedAt(Date.parse(T0) / 1000)
      .setExpirationTime(Date.parse(T0) / 1000 + 60)
      .sign(privateKey);
    expect(await verifyReferralToken(foreign, { clinicId: "cln_mint" })).toEqual({ error: "invalid_signature" });
  });

  it("calls garbage malformed", async () => {
    expect(await verifyReferralToken("", { clinicId: "cln_mint" })).toEqual({ error: "malformed" });
    expect(await verifyReferralToken("not-a-jwt", { clinicId: "cln_mint" })).toEqual({ error: "malformed" });
    expect(await verifyReferralToken("a.b", { clinicId: "cln_mint" })).toEqual({ error: "malformed" });
    // The 03 placeholder: a real header, but the payload is not JSON.
    expect(await verifyReferralToken("eyJhbGciOiJFUzI1NiJ9.example.signature", { clinicId: "cln_mint" })).toEqual({
      error: "malformed",
    });
  });

  it("uses REFERRAL_*_JWK when both are set", async () => {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    const { exportJWK } = await import("jose");
    vi.stubEnv("REFERRAL_PRIVATE_JWK", JSON.stringify({ ...(await exportJWK(privateKey)), kid: "k1" }));
    vi.stubEnv("REFERRAL_PUBLIC_JWK", JSON.stringify({ ...(await exportJWK(publicKey)), kid: "k1" }));
    const token = await issueReferralToken(referral);
    expect(decodeProtectedHeader(token).kid).toBe("k1");
    expect((await jwks()).keys[0].kid).toBe("k1");
    expect(await verifyReferralToken(token, { clinicId: "cln_mint" })).toHaveProperty("jti");
  });
});

describe("agent identities", () => {
  it("stores the card URL from PUBLIC_BASE_URL per role", async () => {
    await registerAgent({ agentId: "cag_7f3k2", role: "customer", ownerId: "cus_yuki" });
    await registerAgent({ agentId: "cln_seoul_glow", role: "clinic", ownerId: "cln_seoul_glow" });
    await registerAgent({ agentId: "agt_platform", role: "platform", ownerId: "pibu" });

    expect(await getAgentIdentity("cag_7f3k2")).toEqual({
      id: "cag_7f3k2",
      agentId: "cag_7f3k2",
      role: "customer",
      cardUrl: "https://pibu.example/a2a/customers/cag_7f3k2/agent-card.json",
      ownerId: "cus_yuki",
      tokenIssuedAt: T0,
    });
    expect((await getAgentIdentity("cln_seoul_glow"))?.cardUrl).toBe(
      "https://pibu.example/a2a/clinics/seoul-glow/agent-card.json",
    );
    expect((await getAgentIdentity("agt_platform"))?.cardUrl).toBe("https://pibu.example/a2a/platform/agent-card.json");
    expect(await getAgentIdentity("cag_unknown")).toBeUndefined();
    expect(clinicSlugFromId("cln_mint")).toBe("mint");
  });
});
