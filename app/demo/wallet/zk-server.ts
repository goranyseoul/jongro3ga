import type { ProofBundle, VerifyResult } from "@/lib/zk/types";
import { parsePublicOffers, type PublicOffer } from "@/lib/zk/browser/offers";

// Browser calls to the glowpass ZK server (docs/INTEGRATION.md 5, CORS *). Only public data goes out:
// the offer list and chain day come in, a proof bundle goes to the clinic verifier. The chart never does.

export const ZK_SERVER_URL = (process.env.NEXT_PUBLIC_ZK_SERVER_URL ?? "http://localhost:4000").replace(/\/+$/, "");

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${ZK_SERVER_URL}${path}`, { cache: "no-store", ...init });
  const body = await response.text();
  let parsed: unknown;
  try {
    parsed = body === "" ? undefined : JSON.parse(body);
  } catch {
    parsed = undefined;
  }
  if (!response.ok) {
    const detail = (parsed as { error?: unknown } | undefined)?.error;
    throw new Error(`${path} ${response.status}: ${typeof detail === "string" ? detail : body.slice(0, 160)}`);
  }
  return parsed;
}

/** Public offer rules (clinic.offers zkClauses), mapped from circuit codes to ids. */
export async function fetchOffers(): Promise<PublicOffer[]> {
  return parsePublicOffers(await request("/api/offers"));
}

/**
 * Chain day of the registry (1 day = 60 s on the demo deployment). The server exposes it in the demo console
 * state as wallet.today; the persona there is irrelevant, only the chain clock is read.
 */
export async function fetchChainToday(): Promise<number> {
  const state = (await request("/api/state?persona=cus_yuki")) as { wallet?: { today?: unknown } } | undefined;
  const today = state?.wallet?.today;
  if (typeof today !== "number" || !Number.isSafeInteger(today)) throw new Error("chain day missing in /api/state");
  return today;
}

/** Clinic side: the verifier sees subjectId, offerId, today, public inputs and proof bytes only. */
export async function requestVerification(clinicId: string, bundle: ProofBundle): Promise<VerifyResult> {
  return (await request("/api/zk/verify-offer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ clinicId, bundle }),
  })) as VerifyResult;
}
