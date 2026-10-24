// Agent tokens and referral tokens (03-a2a-protocol.md "인증과 신뢰"). OWNER: track A2A core.
//
// Agent token: HS256 JWT signed with A2A_TOKEN_SECRET. `sub` = agent id, `role` = customer | platform | clinic.
// Referral token: ES256 JWS signed with the platform key, public key served at /a2a/platform/jwks.json.
// Both use the demo clock (lib/clock.ts) for iat/exp and verification, so a jump of the demo clock
// expires tokens exactly like real time would.
//
// Secrets are never in code. Without A2A_TOKEN_SECRET or REFERRAL_*_JWK the process falls back to a
// random per-process secret and key pair, but only when DEMO_MODE=true (a restart invalidates tokens).
import { SignJWT, exportJWK, generateKeyPair, importJWK, jwtVerify, type JWK, type JWTPayload } from "jose";
import { clock } from "../clock";
import type { AgentRef, AgentRole } from "./contract";

export interface ReferralClaims {
  jti: string;
  /** clinic id the token is valid for (aud) */
  clinicId: string;
  /** customer agent id (sub) */
  customerAgentId: string;
  requestId: string;
  matchId: string;
  scope: ("quote" | "book")[];
  exp: number;
}

export const TOKEN_ISSUER = "pibu-platform";
const AGENT_AUDIENCE = "pibu-a2a";
const AGENT_TOKEN_TTL_S = 12 * 60 * 60;
export const REFERRAL_TTL_S = 72 * 60 * 60;
const ROLES: readonly AgentRole[] = ["customer", "platform", "clinic"];

interface AuthGlobals {
  devSecret?: Uint8Array;
  referralKeys?: Promise<ReferralKeys>;
}

interface ReferralKeys {
  privateKey: CryptoKey | Uint8Array;
  publicKey: CryptoKey | Uint8Array;
  publicJwk: JWK;
  kid: string;
}

declare global {
  var __pibuA2AAuth: AuthGlobals | undefined;
}

const authGlobals = (): AuthGlobals => (globalThis.__pibuA2AAuth ??= {});

function demoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

function nowSeconds(): number {
  return Math.floor(clock.now().getTime() / 1000);
}

function agentSecret(): Uint8Array {
  const configured = process.env.A2A_TOKEN_SECRET;
  if (configured) {
    if (configured.length < 32) throw new Error("A2A_TOKEN_SECRET must be at least 32 characters");
    return new TextEncoder().encode(configured);
  }
  if (!demoMode()) throw new Error("A2A_TOKEN_SECRET is not set (a random dev secret is only used with DEMO_MODE=true)");
  const g = authGlobals();
  return (g.devSecret ??= crypto.getRandomValues(new Uint8Array(32)));
}

// ---- agent tokens ----

export async function issueAgentToken(ref: AgentRef): Promise<string> {
  if (!ROLES.includes(ref.role)) throw new TypeError(`unknown agent role: ${String(ref.role)}`);
  if (!ref.agentId) throw new TypeError("agentId is required");
  const iat = nowSeconds();
  return new SignJWT({ role: ref.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(AGENT_AUDIENCE)
    .setSubject(ref.agentId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + AGENT_TOKEN_TTL_S)
    .sign(agentSecret());
}

/** Expiry (epoch seconds) of an agent token without verifying it, for client side caching. */
export function agentTokenExpiry(token: string): number | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as JWTPayload;
    return typeof payload.exp === "number" ? payload.exp : undefined;
  } catch {
    return undefined;
  }
}

/** Verifies an agent token (raw JWT or a full "Bearer ..." header value). Null when missing or invalid. */
export async function verifyAgentToken(tokenOrHeader: string | null | undefined): Promise<AgentRef | null> {
  const token = bearerToken(tokenOrHeader);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, agentSecret(), {
      issuer: TOKEN_ISSUER,
      audience: AGENT_AUDIENCE,
      algorithms: ["HS256"],
      currentDate: clock.now(),
    });
    const role = payload.role;
    if (typeof payload.sub !== "string" || payload.sub === "") return null;
    if (typeof role !== "string" || !ROLES.includes(role as AgentRole)) return null;
    return { role: role as AgentRole, agentId: payload.sub };
  } catch {
    return null;
  }
}

export function bearerToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^Bearer\s+(.+)$/i.exec(value.trim());
  if (match) return match[1].trim() || null;
  return value.includes(" ") ? null : value.trim() || null;
}

// ---- referral tokens ----

async function loadReferralKeys(): Promise<ReferralKeys> {
  const privateEnv = process.env.REFERRAL_PRIVATE_JWK;
  const publicEnv = process.env.REFERRAL_PUBLIC_JWK;
  if (privateEnv && publicEnv) {
    const privateJwk = JSON.parse(privateEnv) as JWK;
    const publicJwk = JSON.parse(publicEnv) as JWK;
    const kid = publicJwk.kid ?? "pibu-referral-1";
    return {
      privateKey: await importJWK(privateJwk, "ES256"),
      publicKey: await importJWK(publicJwk, "ES256"),
      publicJwk: { kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, y: publicJwk.y, kid, alg: "ES256", use: "sig" },
      kid,
    };
  }
  if (privateEnv || publicEnv) throw new Error("set both REFERRAL_PRIVATE_JWK and REFERRAL_PUBLIC_JWK, or neither");
  if (!demoMode()) throw new Error("REFERRAL_PRIVATE_JWK is not set (a generated key pair is only used with DEMO_MODE=true)");
  const { privateKey, publicKey } = await generateKeyPair("ES256");
  const kid = `pibu-referral-dev-${crypto.randomUUID().slice(0, 8)}`;
  const jwk = await exportJWK(publicKey);
  return { privateKey, publicKey, publicJwk: { ...jwk, kid, alg: "ES256", use: "sig" }, kid };
}

function referralKeys(): Promise<ReferralKeys> {
  const g = authGlobals();
  if (!g.referralKeys) {
    g.referralKeys = loadReferralKeys();
    // A failed load (missing env) must not be cached forever.
    g.referralKeys.catch(() => {
      if (authGlobals().referralKeys) delete authGlobals().referralKeys;
    });
  }
  return g.referralKeys;
}

/** JWKS document for /a2a/platform/jwks.json (public key only). */
export async function referralJwks(): Promise<{ keys: JWK[] }> {
  const keys = await referralKeys();
  return { keys: [keys.publicJwk] };
}

export interface IssueReferralInput {
  clinicId: string;
  customerAgentId: string;
  requestId: string;
  matchId: string;
  scope?: ("quote" | "book")[];
}

/** Signs a referral token for one candidate clinic: aud = clinic id, 72 hours, unique jti (attribution key). */
export async function issueReferralToken(input: IssueReferralInput): Promise<{ token: string; jti: string; exp: number }> {
  const keys = await referralKeys();
  const iat = nowSeconds();
  const exp = iat + REFERRAL_TTL_S;
  const jti = `ref_${crypto.randomUUID().replace(/-/g, "")}`;
  const token = await new SignJWT({ rid: input.requestId, mid: input.matchId, scope: input.scope ?? ["quote", "book"] })
    .setProtectedHeader({ alg: "ES256", kid: keys.kid, typ: "JWT" })
    .setIssuer(TOKEN_ISSUER)
    .setAudience(input.clinicId)
    .setSubject(input.customerAgentId)
    .setJti(jti)
    .setIssuedAt(iat)
    .setExpirationTime(exp)
    .sign(keys.privateKey);
  return { token, jti, exp };
}

async function decodeReferral(token: string, clinicId: string, allowExpired: boolean): Promise<ReferralClaims | null> {
  if (!token || !clinicId) return null;
  try {
    const keys = await referralKeys();
    const { payload } = await jwtVerify(token, keys.publicKey, {
      issuer: TOKEN_ISSUER,
      audience: clinicId,
      algorithms: ["ES256"],
      currentDate: clock.now(),
      // jose rejects exp <= now with a tolerance; allowExpired widens it for attribution after the fact.
      ...(allowExpired ? { clockTolerance: 365 * 24 * 60 * 60 } : {}),
    });
    const scope = Array.isArray(payload.scope) ? payload.scope.filter((s): s is "quote" | "book" => s === "quote" || s === "book") : [];
    if (typeof payload.jti !== "string" || typeof payload.sub !== "string" || typeof payload.exp !== "number") return null;
    if (typeof payload.rid !== "string" || typeof payload.mid !== "string") return null;
    return {
      jti: payload.jti,
      clinicId,
      customerAgentId: payload.sub,
      requestId: payload.rid,
      matchId: payload.mid,
      scope,
      exp: payload.exp,
    };
  } catch {
    return null;
  }
}

/** Returns claims when valid for this clinic and not expired, otherwise null. */
export async function verifyReferralToken(token: string, clinicId: string): Promise<ReferralClaims | null> {
  return decodeReferral(token, clinicId, false);
}

/**
 * Signature and audience check that tolerates expiry. Used by platform.report_booking: the clinic accepted
 * the token while it was valid, attribution may be reported after the 72 hours.
 */
export async function verifyReferralTokenForAttribution(token: string, clinicId: string): Promise<ReferralClaims | null> {
  return decodeReferral(token, clinicId, true);
}
