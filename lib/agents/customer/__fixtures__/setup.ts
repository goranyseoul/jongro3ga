import { vi } from "vitest";
import { refreshOfferCache } from "../../../a2a/__fixtures__/platform-admin";
import { routeFetch } from "../../../a2a/__fixtures__/route-fetch";
import { clearAgentCardCache } from "../../../a2a/client";
import { listA2ALog } from "../../../a2a/log";
import { resetTaskStores } from "../../../a2a/server";
import { resetClock, setClock } from "../../../clock";
import { getStore, resetStore } from "../../../store";
import type { PublicOffer } from "../../../zk/browser/offers";
import type { ProofBundle, WalletView } from "../../../zk/types";
import { draftRequest } from "../intent";
import type { StoredRequest } from "../store";

// Test only: the customer agent tests run the real A2A routes in process (routeFetch), fixture LLM mode
// (DEMO_MODE=true), the demo clock and the seed. The platform's offer cache is filled over clinic.offers the way
// the platform does it at boot (BUILD-LOG 23 (1)).

export const BASE = "https://pibu.example";
export const NOW = "2026-11-12T10:00:00+09:00";
export const YUKI = { customerId: "cus_yuki_done", agentId: "cag_7f3k2d" } as const;
export const LIN = { customerId: "cus_lin", agentId: "cag_2m8x9" } as const;
export const SUBJECT = `0x${"5c".repeat(32)}`;

export async function setupCustomerTest(): Promise<void> {
  vi.stubEnv("DEMO_MODE", "true");
  vi.stubEnv("PUBLIC_BASE_URL", BASE);
  vi.stubEnv("ANTHROPIC_API_KEY", "");
  // Anything that would use the default fetch (a clinic's autoConfirm report, the offer catalog) stays in process.
  vi.stubGlobal("fetch", routeFetch);
  setClock(NOW);
  resetStore({ seed: true });
  resetTaskStores();
  clearAgentCardCache();
  const refreshed = await refreshOfferCache({ fetchImpl: routeFetch });
  if (refreshed.failed.length > 0) throw new Error(`offer cache refresh failed: ${JSON.stringify(refreshed.failed)}`);
}

export function teardownCustomerTest(): void {
  resetClock();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
}

/** The wallet server's public offer catalog (glowpass GET /api/offers), parsed: ids with the seed's clauses. */
export const CATALOG: PublicOffer[] = [
  {
    id: "ofr_mint_rejuran_first_visit",
    clinicId: "cln_mint",
    clinic: "민트피부과의원",
    title: "첫 방문 1cc 이벤트",
    benefit: "",
    conditions: [],
    clauses: [{ clinicId: "cln_mint", maxCount: 0 }],
  },
  {
    id: "ofr_hanbit_first_visit",
    clinicId: "cln_hanbit",
    clinic: "한빛의원",
    title: "한빛 첫 방문 10%",
    benefit: "",
    conditions: [],
    clauses: [{ clinicId: "cln_hanbit", maxCount: 0 }],
  },
  {
    id: "ofr_seoul_glow_rejuran_second",
    clinicId: "cln_seoul_glow",
    clinic: "서울글로우의원",
    title: "리쥬란 2회차 패키지 10%",
    benefit: "",
    conditions: [],
    clauses: [{ type: "rejuran_healer", minCount: 1, maxCount: 1 }],
  },
  {
    id: "ofr_hanbit_rejuran_continue",
    clinicId: "cln_hanbit",
    clinic: "한빛의원",
    title: "리쥬란 이어서 2회차 10%",
    benefit: "",
    conditions: [],
    clauses: [{ type: "rejuran_healer", clinicId: "cln_hanbit", minCount: 1, maxCount: 1 }],
  },
];

export const catalog = async (): Promise<PublicOffer[]> => CATALOG;

/** What glowpass answers to prove-offer (one 8 input proof per clause). */
export const bundleFor = (persona: string, offerId: string): ProofBundle => ({
  subjectId: SUBJECT,
  offerId,
  today: 29_880_272,
  provingMs: 400,
  proofs: [{ proof: "0x1f2e3d4c", publicInputs: ["0x0b1c2d3e", "29880272", "0", "2", "0", "100000", "0", "0"] }],
  ...(persona === "cus_yuki" ? { unanchored: true } : {}),
});

export const walletOf = (version = 0): WalletView => ({
  today: 29_880_272,
  verifiedRecords: [],
  selfReported: [],
  onchain: { subjectId: SUBJECT, commitment: "0x0", version },
  pendingReviews: [],
});

/** Yuki's "リジュラン受けたい" through draftRequest (fixture LLM, platform.recipe over A2A). */
export async function draftYuki(utterance = "リジュラン受けたい"): Promise<StoredRequest> {
  const result = await draftRequest(YUKI.customerId, utterance, { fetchImpl: routeFetch });
  if (!result.ok) throw new Error(`draft failed: ${JSON.stringify(result)}`);
  return result.request;
}

export async function draftLin(): Promise<StoredRequest> {
  const result = await draftRequest(LIN.customerId, "想做丽珠兰", { fetchImpl: routeFetch });
  if (!result.ok) throw new Error(`draft failed: ${JSON.stringify(result)}`);
  return result.request;
}

/** A2A log of one request, oldest first. */
export const logOf = (contextId: string) => listA2ALog(getStore(), { contextId });
