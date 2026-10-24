// Agent-facing ZK bridge for the clinic and customer agents (HTTP client to GlowPass). Re-exported by index.ts.
// Customer and clinic agents call these when ZK_SERVER_URL is set; null means "ZK not configured, skip".
//
// HTTP client for the GlowPass server (glowpass/server.mjs). Every call has a timeout and never throws:
// not configured, unknown id, unreachable, timeout or a malformed answer all come back as null, so the
// demo keeps running at list price when the ZK server is down.
import { fromGlowpassClinic, toGlowpassClinic, toGlowpassPersona } from "./identity";

export interface ZkOfferProofBundle {
  subjectId: string;
  offerId: string;
  today: number;
  proofs: { proof: string; publicInputs: string[] }[];
}

export interface ZkVerification {
  ok: boolean;
  reason?: string;
}

/** A2A extension URI: declared on clinic and customer cards, listed in message.extensions when a proof is attached. */
export const ZK_OFFER_PROOF_EXTENSION = "https://pibu.app/ext/zk-offer-proof/v1";
/** Message metadata key on clinic.quote that carries the proof bundle. */
export const ZK_OFFER_PROOF_METADATA_KEY = "zkOfferProof";

export function zkEnabled(): boolean {
  return Boolean(process.env.ZK_SERVER_URL);
}

/** Customer side: offers this customer is eligible for, matched on the device/server holding the chart. */
export async function matchOffers(persona: string): Promise<{ clinicId: string; offerId: string; title: string; eligible: boolean }[] | null> {
  const offers = await matchOffersDetailed(persona);
  return offers?.map(({ clinicId, offerId, title, eligible }) => ({ clinicId, offerId, title, eligible })) ?? null;
}

/** Customer side: build the proof bundle to attach as metadata.zkOfferProof on clinic.quote. */
export async function proveOffer(persona: string, offerId: string): Promise<ZkOfferProofBundle | null> {
  const gp = toGlowpassPersona(persona);
  if (!gp || !offerId) return null;
  const res = await call("/api/zk/prove-offer", { persona: gp, offerId }, timeoutMs("prove"));
  if (!res || !res.ok) return null; // 500 "Cannot satisfy constraint" = not eligible, or no wallet on this machine
  const bundle = parseBundle(res.body);
  return bundle && bundle.offerId === offerId ? bundle : null;
}

/** Clinic side: verify before applying an offer discount. */
export async function verifyOffer(clinicId: string, bundle: ZkOfferProofBundle): Promise<ZkVerification | null> {
  if (!zkEnabled()) return null;
  const gp = toGlowpassClinic(clinicId);
  if (!gp) return { ok: false, reason: `clinic ${clinicId} is not in the ZK registry` };
  const clean = parseBundle(bundle);
  if (!clean) return { ok: false, reason: "malformed proof bundle" };
  const res = await call("/api/zk/verify-offer", { clinicId: gp, bundle: clean }, timeoutMs("verify"));
  if (!res) return null;
  const body = res.body as { ok?: unknown; reason?: unknown; error?: unknown } | null;
  if (!res.ok) return { ok: false, reason: `zk server error: ${typeof body?.error === "string" ? body.error : res.status}` };
  if (typeof body?.ok !== "boolean") return null;
  return { ok: body.ok, ...(typeof body.reason === "string" ? { reason: body.reason } : {}) };
}

// ---------- extra helpers (additive, not part of the shared contract) ----------

export interface ZkOfferMatch {
  clinicId: string;
  offerId: string;
  title: string;
  eligible: boolean;
  /** Procedure the offer is for (first-visit offers still name the procedure they discount). */
  procedureId?: string;
  /** Customer-facing benefit text from the clinic's public offer rule. */
  benefit?: string;
  /** Human-readable public conditions, e.g. "민트피부과의원 기록 0건". */
  conditions?: string[];
}

/** Same as matchOffers with the public benefit and condition texts (for screens). */
export async function matchOffersDetailed(persona: string): Promise<ZkOfferMatch[] | null> {
  const gp = toGlowpassPersona(persona);
  if (!gp) return null;
  const res = await call("/api/zk/match-offers", { persona: gp }, timeoutMs("match"));
  if (!res || !res.ok || !Array.isArray(res.body)) return null;
  const out: ZkOfferMatch[] = [];
  for (const row of res.body as Record<string, unknown>[]) {
    if (typeof row?.offerId !== "string" || typeof row.clinicId !== "string" || typeof row.eligible !== "boolean") return null;
    const clinicId = fromGlowpassClinic(row.clinicId);
    if (!clinicId) continue; // offer of a clinic PibooK does not list
    out.push({
      clinicId,
      offerId: row.offerId,
      title: typeof row.title === "string" ? row.title : row.offerId,
      eligible: row.eligible,
      ...(typeof row.procedureId === "string" ? { procedureId: row.procedureId } : {}),
      ...(typeof row.benefit === "string" ? { benefit: row.benefit } : {}),
      ...(Array.isArray(row.conditions) ? { conditions: row.conditions.filter((c): c is string => typeof c === "string") } : {}),
    });
  }
  return out;
}

export interface ZkPublicOffer {
  offerId: string;
  clinicId: string;
  procedureId: string;
  title: string;
  benefit: string;
  conditions: string[];
}

/** Clinic side: the public offer rules (what a clinic card can advertise, and the terms of a verified offerId). */
export async function publicOffers(): Promise<ZkPublicOffer[] | null> {
  const res = await call("/api/offers", undefined, timeoutMs("match"));
  if (!res || !res.ok || !Array.isArray(res.body)) return null;
  const out: ZkPublicOffer[] = [];
  for (const o of res.body as Record<string, unknown>[]) {
    const clinicId = typeof o?.clinicId === "string" ? fromGlowpassClinic(o.clinicId) : null;
    if (!clinicId || typeof o.id !== "string" || typeof o.procedureId !== "string") continue;
    out.push({
      offerId: o.id,
      clinicId,
      procedureId: o.procedureId,
      title: typeof o.title === "string" ? o.title : o.id,
      benefit: typeof o.benefit === "string" ? o.benefit : "",
      conditions: Array.isArray(o.conditions) ? o.conditions.filter((c): c is string => typeof c === "string") : [],
    });
  }
  return out;
}

export interface ZkLedgerSummary {
  chainId: number | null;
  registry: string | null;
  secondsPerDay: number | null;
  /** RecordAppended events on chain (one per clinic-confirmed record). */
  records: number;
  /** Distinct pseudonyms with at least one record. */
  pseudonyms: number;
  latest: { tx: string; block: number; at: string | null; subjectId: string; version: number; day: number }[];
}

/** Public ledger summary: only what anyone can read from Base Sepolia (pseudonym, hash, version, tx). */
export async function ledgerSummary(limit = 10): Promise<ZkLedgerSummary | null> {
  const res = await call("/api/ledger", undefined, timeoutMs("ledger"));
  if (!res || !res.ok) return null;
  const body = res.body as { deployment?: Record<string, unknown>; ledger?: unknown } | null;
  if (!body || !Array.isArray(body.ledger)) return null;
  const events = (body.ledger as Record<string, unknown>[]).filter((e) => typeof e?.tx === "string" && typeof e.subjectId === "string");
  const dep = body.deployment ?? {};
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    chainId: num(dep.chainId),
    registry: typeof dep.registry === "string" ? dep.registry : null,
    secondsPerDay: num(dep.secondsPerDay),
    records: events.length,
    pseudonyms: new Set(events.map((e) => e.subjectId)).size,
    latest: events.slice(0, Math.max(0, limit)).map((e) => ({
      tx: e.tx as string,
      block: num(e.block) ?? 0,
      at: typeof e.timestamp === "number" ? new Date(e.timestamp).toISOString() : null,
      subjectId: e.subjectId as string,
      version: num(e.version) ?? 0,
      day: num(e.day) ?? 0,
    })),
  };
}

/** Clinic side: read and shape-check metadata.zkOfferProof from an incoming A2A message. */
export function readOfferProof(metadata: Record<string, unknown> | undefined | null): ZkOfferProofBundle | null {
  return parseBundle(metadata?.[ZK_OFFER_PROOF_METADATA_KEY]);
}

// ---------- internals ----------

type CallKind = "match" | "prove" | "verify" | "ledger";
// match is a chain read; prove builds one UltraHonk proof per clause (about 0.4 s each, plus a few
// seconds to start the prover on the first call); verify starts the prover too; the first ledger read
// scans the chain in 200-block chunks.
const DEFAULT_TIMEOUT_MS: Record<CallKind, number> = { match: 5_000, prove: 20_000, verify: 15_000, ledger: 10_000 };

function timeoutMs(kind: CallKind): number {
  const override = Number(process.env.ZK_TIMEOUT_MS);
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_TIMEOUT_MS[kind];
}

async function call(path: string, body: unknown, timeout: number): Promise<{ ok: boolean; status: number; body: unknown } | null> {
  const base = process.env.ZK_SERVER_URL?.replace(/\/+$/, "");
  if (!base) return null;
  try {
    const res = await fetch(`${base}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", "x-client-id": "pibook-app" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
      cache: "no-store",
    });
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
    return { ok: res.ok, status: res.status, body: parsed };
  } catch {
    return null; // unreachable, refused, timeout
  }
}

function parseBundle(v: unknown): ZkOfferProofBundle | null {
  if (!v || typeof v !== "object") return null;
  const b = v as Record<string, unknown>;
  if (typeof b.subjectId !== "string" || typeof b.offerId !== "string" || typeof b.today !== "number" || !Array.isArray(b.proofs)) return null;
  const proofs: ZkOfferProofBundle["proofs"] = [];
  for (const p of b.proofs as Record<string, unknown>[]) {
    if (typeof p?.proof !== "string" || !Array.isArray(p.publicInputs) || !p.publicInputs.every((x) => typeof x === "string")) return null;
    proofs.push({ proof: p.proof, publicInputs: p.publicInputs as string[] });
  }
  if (!proofs.length) return null;
  return { subjectId: b.subjectId, offerId: b.offerId, today: b.today, proofs };
}
