import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { advanceClockHours, resetClock, setClock } from "../clock";
import {
  issueAgentToken,
  issueReferralToken,
  referralJwks,
  verifyAgentToken,
  verifyReferralToken,
  verifyReferralTokenForAttribution,
} from "./auth";

const saved = { ...process.env };

beforeEach(() => {
  process.env.DEMO_MODE = "true";
  delete process.env.A2A_TOKEN_SECRET;
  setClock("2026-10-24T10:00:00+09:00");
});

afterEach(() => {
  process.env = { ...saved };
  resetClock();
});

const referral = { clinicId: "cln_mint", customerAgentId: "cag_7f3k2", requestId: "req_01J9Z8", matchId: "mt_4401" };

describe("agent tokens", () => {
  it("round trips role and agent id, accepting a Bearer header", async () => {
    const token = await issueAgentToken({ role: "clinic", agentId: "cln_mint" });
    expect(await verifyAgentToken(token)).toEqual({ role: "clinic", agentId: "cln_mint" });
    expect(await verifyAgentToken(`Bearer ${token}`)).toEqual({ role: "clinic", agentId: "cln_mint" });
  });

  it("rejects missing, tampered and expired tokens", async () => {
    const token = await issueAgentToken({ role: "customer", agentId: "cag_7f3k2" });
    expect(await verifyAgentToken(null)).toBeNull();
    expect(await verifyAgentToken("")).toBeNull();
    const [h, p, s] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, "base64url").toString()), role: "platform" })).toString("base64url");
    expect(await verifyAgentToken(`${h}.${forgedPayload}.${s}`)).toBeNull();
    advanceClockHours(13);
    expect(await verifyAgentToken(token)).toBeNull();
  });

  it("uses A2A_TOKEN_SECRET when set and refuses to run without it outside DEMO_MODE", async () => {
    process.env.A2A_TOKEN_SECRET = "x".repeat(40);
    const token = await issueAgentToken({ role: "platform", agentId: "platform" });
    process.env.A2A_TOKEN_SECRET = "y".repeat(40);
    expect(await verifyAgentToken(token)).toBeNull();
    delete process.env.A2A_TOKEN_SECRET;
    process.env.DEMO_MODE = "false";
    await expect(issueAgentToken({ role: "platform", agentId: "platform" })).rejects.toThrow(/A2A_TOKEN_SECRET/);
  });
});

describe("referral tokens", () => {
  it("verifies for the audience clinic and carries the 03 claims", async () => {
    const { token, jti, exp } = await issueReferralToken(referral);
    const claims = await verifyReferralToken(token, "cln_mint");
    expect(claims).toEqual({ jti, clinicId: "cln_mint", customerAgentId: "cag_7f3k2", requestId: "req_01J9Z8", matchId: "mt_4401", scope: ["quote", "book"], exp });
    expect(jti).toMatch(/^ref_/);
    expect(exp - Math.floor(Date.parse("2026-10-24T10:00:00+09:00") / 1000)).toBe(72 * 3600);
  });

  it("rejects another clinic's token (aud)", async () => {
    const { token } = await issueReferralToken(referral);
    expect(await verifyReferralToken(token, "cln_seoul_glow")).toBeNull();
  });

  it("expires after 72 hours, attribution still reads it", async () => {
    const { token } = await issueReferralToken(referral);
    advanceClockHours(71);
    expect(await verifyReferralToken(token, "cln_mint")).not.toBeNull();
    advanceClockHours(2);
    expect(await verifyReferralToken(token, "cln_mint")).toBeNull();
    expect(await verifyReferralTokenForAttribution(token, "cln_mint")).not.toBeNull();
    expect(await verifyReferralTokenForAttribution(token, "cln_ara")).toBeNull();
  });

  it("rejects a token signed by a foreign key", async () => {
    const { privateKey } = await generateKeyPair("ES256");
    const now = Math.floor(Date.parse("2026-10-24T10:00:00+09:00") / 1000);
    const foreign = await new SignJWT({ rid: "req_01J9Z8", mid: "mt_4401", scope: ["quote", "book"] })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer("pibu-platform")
      .setAudience("cln_mint")
      .setSubject("cag_7f3k2")
      .setJti("ref_foreign")
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(privateKey);
    expect(await verifyReferralToken(foreign, "cln_mint")).toBeNull();
    expect(await verifyReferralToken("not-a-token", "cln_mint")).toBeNull();
  });

  it("serves only the public half in the JWKS", async () => {
    const { keys } = await referralJwks();
    expect(keys[0]).toMatchObject({ kty: "EC", crv: "P-256", alg: "ES256" });
    expect(keys[0]).not.toHaveProperty("d");
    const { publicKey } = await generateKeyPair("ES256");
    expect(Object.keys(await exportJWK(publicKey)).sort()).toEqual(["crv", "kty", "x", "y"]);
  });
});
