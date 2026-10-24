import { OffersV1Schema } from "../../a2a/schemas";
import { sendMessage } from "../../a2a/client";
import { taskArtifactData } from "../../a2a/wire";
import { clock } from "../../clock";
import type { ClinicOfferCache } from "../../domain";
import { PLATFORM_AGENT_ID } from "../../store";
import { platformStore } from "./store";

// The platform's copy of every clinic's menus and monthly offers (07 2절: the platform never reads the clinic
// store). Refreshed over A2A `clinic.offers` at boot, from the ops console [오퍼 새로고침] and every 6 hours.

export interface OfferRefreshResult {
  updated: string[];
  /** Clinics whose call failed; their previous cache entry is kept. */
  failed: { clinicId: string; reason: string }[];
}

export async function refreshOfferCache(opts: { fetchImpl?: typeof fetch } = {}): Promise<OfferRefreshResult> {
  const result: OfferRefreshResult = { updated: [], failed: [] };
  const contextId = `ctx_offer_refresh_${clock.now().getTime()}`;
  for (const entry of await platformStore.registry()) {
    try {
      const task = await sendMessage({
        from: { agentId: PLATFORM_AGENT_ID, role: "platform" },
        toCardUrl: entry.agentCardUrl,
        skillId: "clinic.offers",
        data: { schema: "pibu/offers-query@1" },
        contextId,
        ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      });
      if (task.status.state !== "TASK_STATE_COMPLETED") throw new Error(`clinic.offers answered ${task.status.state}`);
      const parsed = OffersV1Schema.safeParse(taskArtifactData(task));
      if (!parsed.success) throw new Error("clinic.offers artifact is not pibu/offers@1");
      if (parsed.data.clinicId !== entry.id) throw new Error(`clinic.offers answered for ${parsed.data.clinicId}`);
      const cache: ClinicOfferCache = { id: entry.id, clinicId: entry.id, offers: parsed.data, fetchedAt: clock.nowIso() };
      await platformStore.putOfferCache(cache);
      result.updated.push(entry.id);
    } catch (error) {
      result.failed.push({ clinicId: entry.id, reason: error instanceof Error ? error.message : String(error) });
    }
  }
  return result;
}
