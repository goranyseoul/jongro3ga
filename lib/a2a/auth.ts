import {
  SignJWT,
  calculateJwkThumbprint,
  errors,
  exportJWK,
  generateKeyPair,
  importJWK,
  jwtVerify,
  type CryptoKey,
  type JSONWebKeySet,
  type JWK,
} from "jose";
import { clock } from "../clock";
import type { AgentIdentity, AgentRole } from "../domain";
import { pibuGlobals } from "../pibu-globals";
import { COLLECTIONS } from "../store/collections";
import { getStore } from "../store";
import { agentUrls } from "./cards";

// Agent tokens and referral tokens, docs/spec/03-a2a-protocol.md "인증과 신뢰".
// Every expiry is computed from and checked against `clock.now()`, so the demo clock decides what is
// expired. jose's `exp`/`iat` are epoch seconds.

export const ISSUER = "pibu-platform";
const AGENT_TOKEN_TTL_S = 7 * 24 * 60 * 60;
const REFERRAL_TTL_S = 72 * 60 * 60;
const ROLES: readonly AgentRole[] = ["customer", "platform", "clinic"];

const nowSeconds = (): number => Math.floor(clock.now().getTime() / 1000);

// ---- agent token (HS256) ----

export interface Caller {
  agentId: string;
  role: AgentRole;
}

function agentTokenSecret(): Uint8Array {
  const fromEnv = process.env.A2A_TOKEN_SECRET;
  if (fromEnv) return new TextEncoder().encode(fromEnv);
  const g = pibuGlobals();
  if (!g.agentTokenSecret) {
    g.agentTokenSecret = crypto.getRandomValues(new Uint8Array(32));
    console.warn("A2A_TOKEN_SECRET is empty: using a random secret for this process (demo only, tokens die on restart)");
  }
  return g.agentTokenSecret;
}

export async function issueAgentToken({ agentId, role }: Caller): Promise<string> {
  const iat = nowSeconds();
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(ISSUER)
    .setSubject(agentId)
    .setIssuedAt(iat)
    .setExpirationTime(iat + AGENT_TOKEN_TTL_S)
    .sign(agentTokenSecret());
}

/** Reads `Authorization: Bearer <token>`. Missing header, bad signature, expired or malformed tokens give null. */
export async function verifyAgentToken(authorizationHeader: string | null | undefined): Promise<Caller | null> {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authorizationHeader ?? "");
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], agentTokenSecret(), {
      algorithms: ["HS256"],
      issuer: ISSUER,
      requiredClaims: ["sub", "exp", "iat"],
      currentDate: clock.now(),
    });
    const role = payload.role;
    if (typeof payload.sub !== "string" || payload.sub === "") return null;
    if (typeof role !== "string" || !ROLES.includes(role as AgentRole)) return null;
    return { agentId: payload.sub, role: role as AgentRole };
  } catch {
    return null;
  }
}

// ---- referral token (ES256 JWS) ----

export interface ReferralClaims {
  iss: typeof ISSUER;
  /** Clinic id, e.g. "cln_mint". */
  aud: string;
  /** Customer agent id. */
  sub: string;
  /** requestId */
  rid: string;
  /** matchId */
  mid: string;
  scope: string[];
  /** Unique token id, the attribution key. */
  jti: string;
  iat: number;
  exp: number;
}

export type ReferralError = { error: "expired" | "invalid_signature" | "wrong_audience" | "malformed" };

interface ReferralKeys {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JWK;
}

let envKeys: Promise<ReferralKeys> | undefined;

async function referralKeys(): Promise<ReferralKeys> {
  const privateJwk = process.env.REFERRAL_PRIVATE_JWK;
  const publicJwk = process.env.REFERRAL_PUBLIC_JWK;
  if (privateJwk && publicJwk) {
    envKeys ??= (async () => {
      const pub = JSON.parse(publicJwk) as JWK;
      return {
        privateKey: (await importJWK(JSON.parse(privateJwk) as JWK, "ES256")) as CryptoKey,
        publicKey: (await importJWK(pub, "ES256")) as CryptoKey,
        publicJwk: pub,
      };
    })();
    return envKeys;
  }
  const g = pibuGlobals();
  if (!g.referralKeys) {
    const { privateKey, publicKey } = await generateKeyPair("ES256", { extractable: true });
    // Another request may have generated a pair while this one awaited: keep the first.
    g.referralKeys ??= { privateKey, publicKey, publicJwk: await exportJWK(publicKey) };
  }
  return g.referralKeys;
}

async function keyId(jwk: JWK): Promise<string> {
  return jwk.kid ?? (await calculateJwkThumbprint(jwk));
}

export async function issueReferralToken(input: {
  clinicId: string;
  customerAgentId: string;
  requestId: string;
  matchId: string;
}): Promise<string> {
  const keys = await referralKeys();
  const iat = nowSeconds();
  return new SignJWT({ rid: input.requestId, mid: input.matchId, scope: ["quote", "book"] })
    .setProtectedHeader({ alg: "ES256", typ: "JWT", kid: await keyId(keys.publicJwk) })
    .setIssuer(ISSUER)
    .setAudience(input.clinicId)
    .setSubject(input.customerAgentId)
    .setJti(crypto.randomUUID())
    .setIssuedAt(iat)
    .setExpirationTime(iat + REFERRAL_TTL_S)
    .sign(keys.privateKey);
}

/** Checks a referral token for one clinic. Never throws: the clinic answers TASK_STATE_REJECTED on an error. */
export async function verifyReferralToken(
  token: string,
  { clinicId }: { clinicId: string },
): Promise<ReferralClaims | ReferralError> {
  if (typeof token !== "string" || token === "") return { error: "malformed" };
  const keys = await referralKeys();
  try {
    const { payload } = await jwtVerify(token, keys.publicKey, {
      algorithms: ["ES256"],
      issuer: ISSUER,
      audience: clinicId,
      requiredClaims: ["sub", "jti", "exp", "iat"],
      currentDate: clock.now(),
    });
    const { rid, mid, scope } = payload;
    if (typeof rid !== "string" || typeof mid !== "string") return { error: "malformed" };
    if (!Array.isArray(scope) || !scope.every((s) => typeof s === "string")) return { error: "malformed" };
    return {
      iss: ISSUER,
      aud: clinicId,
      sub: payload.sub!,
      rid,
      mid,
      scope,
      jti: payload.jti!,
      iat: payload.iat!,
      exp: payload.exp!,
    };
  } catch (error) {
    if (error instanceof errors.JWTExpired) return { error: "expired" };
    if (error instanceof errors.JWTClaimValidationFailed && error.claim === "aud") return { error: "wrong_audience" };
    if (error instanceof errors.JWSSignatureVerificationFailed || error instanceof errors.JOSEAlgNotAllowed) {
      return { error: "invalid_signature" };
    }
    return { error: "malformed" };
  }
}

/** Public referral key set, served at /a2a/platform/jwks.json. */
export async function jwks(): Promise<JSONWebKeySet> {
  const { publicJwk } = await referralKeys();
  const { kty, crv, x, y } = publicJwk;
  return { keys: [{ kty, crv, x, y, kid: await keyId(publicJwk), alg: "ES256", use: "sig" }] };
}

// ---- agent identities (shared namespace) ----

const NAMESPACE = "shared";
const IDENTITIES = COLLECTIONS.shared.agentIdentities;

export type StoredAgentIdentity = AgentIdentity & { id: string };

/** "cln_seoul_glow" -> "seoul-glow", the slug convention of every seeded clinic. */
export const clinicSlugFromId = (clinicId: string): string => clinicId.replace(/^cln_/, "").replace(/_/g, "-");

function cardUrlFor(agentId: string, role: AgentRole, slug?: string): string {
  if (role === "platform") return agentUrls.platform().card;
  if (role === "clinic") return agentUrls.clinic(slug ?? clinicSlugFromId(agentId)).card;
  return agentUrls.customer(agentId).card;
}

/** Records who an agent is. Clinic slugs default to the id convention; pass `slug` when it differs. */
export async function registerAgent(input: {
  agentId: string;
  role: AgentRole;
  ownerId: string;
  slug?: string;
}): Promise<StoredAgentIdentity> {
  const identity: StoredAgentIdentity = {
    id: input.agentId,
    agentId: input.agentId,
    role: input.role,
    cardUrl: cardUrlFor(input.agentId, input.role, input.slug),
    ownerId: input.ownerId,
    tokenIssuedAt: clock.nowIso(),
  };
  await getStore().put(NAMESPACE, IDENTITIES, identity);
  return identity;
}

export async function getAgentIdentity(agentId: string): Promise<StoredAgentIdentity | undefined> {
  return getStore().get<StoredAgentIdentity>(NAMESPACE, IDENTITIES, agentId);
}
