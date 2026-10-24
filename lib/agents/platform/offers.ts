// Offer cache (07 2절): the platform never reads the clinic store. It asks each clinic agent for
// clinic.offers over A2A and keeps the answer as ClinicOfferCache in the platform namespace.
// Refreshed when missing or older than 6 hours (demo clock), and on demand (ops [오퍼 새로고침]).
import { clock } from "../../clock";
import { absoluteUrl } from "../../a2a/cards";
import { sendMessage } from "../../a2a/client";
import type { AgentRef } from "../../a2a/contract";
import { OffersV1Schema } from "../../a2a/schemas";
import { taskArtifactData } from "../../a2a/wire";
import type { ClinicOfferCache, ClinicRegistryEntry } from "../../domain";
import { platformStore } from "./store";

export const PLATFORM_REF: AgentRef = { role: "platform", agentId: "platform" };
export const OFFER_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;
const OFFERS_TIMEOUT_MS = 10_000;

const isStale = (cache: ClinicOfferCache | undefined, nowMs: number) =>
  !cache || nowMs - Date.parse(cache.fetchedAt) > OFFER_CACHE_MAX_AGE_MS || nowMs < Date.parse(cache.fetchedAt);

async function fetchOffers(entry: ClinicRegistryEntry): Promise<ClinicOfferCache> {
  const task = await sendMessage({
    from: PLATFORM_REF,
    toCardUrl: absoluteUrl(entry.agentCardUrl),
    skillId: "clinic.offers",
    data: { schema: "pibu/offers-query@1", month: clock.today().slice(0, 7) },
    text: "Monthly offers for the platform offer cache",
    contextId: `ctx_offers_${clock.today().replace(/-/g, "")}`,
    timeoutMs: OFFERS_TIMEOUT_MS,
  });
  if (task.status.state !== "TASK_STATE_COMPLETED") throw new Error(`clinic.offers answered ${task.status.state}`);
  const parsed = OffersV1Schema.safeParse(taskArtifactData(task));
  if (!parsed.success) throw new Error(`clinic.offers returned an invalid pibu/offers@1: ${parsed.error.issues[0]?.message ?? ""}`);
  if (parsed.data.clinicId !== entry.id) throw new Error(`clinic.offers for ${entry.id} answered for ${parsed.data.clinicId}`);
  const cache: ClinicOfferCache = { id: `oc_${entry.id}`, clinicId: entry.id, offers: parsed.data, fetchedAt: clock.nowIso() };
  await platformStore.putOfferCache(cache);
  return cache;
}

export interface RefreshResult {
  refreshed: string[];
  failed: { clinicId: string; error: string }[];
  cache: Map<string, ClinicOfferCache>;
}

/**
 * Makes sure the offer cache is fresh for the given registry entries (default: all). `force` refetches
 * everything. A clinic that does not answer keeps its previous cache; without one it fails hard filter 2.
 */
export async function refreshOfferCache(options: { entries?: ClinicRegistryEntry[]; force?: boolean } = {}): Promise<RefreshResult> {
  const entries = options.entries ?? (await platformStore.registry());
  const existing = new Map((await platformStore.offerCache()).map((c) => [c.clinicId, c]));
  const nowMs = clock.now().getTime();
  const todo = entries.filter((e) => options.force || isStale(existing.get(e.id), nowMs));
  const settled = await Promise.allSettled(todo.map((e) => fetchOffers(e)));
  const result: RefreshResult = { refreshed: [], failed: [], cache: existing };
  settled.forEach((s, i) => {
    const clinicId = todo[i].id;
    if (s.status === "fulfilled") {
      result.refreshed.push(clinicId);
      existing.set(clinicId, s.value);
    } else {
      result.failed.push({ clinicId, error: s.reason instanceof Error ? s.reason.message : String(s.reason) });
    }
  });
  if (result.failed.length) console.warn("[platform] offer cache refresh failed for", result.failed);
  return result;
}
