import { getProcedure } from "../../../../lib/domain/procedure-master";
import type { ClinicRegistryEntry } from "../../../../lib/domain/platform";
import type { Store } from "../../../../lib/store/types";
import { PLATFORM_COLLECTIONS, clinicDisplayName } from "../../../../lib/agents/platform/signals";

/** Korean procedure name from the master, or the id itself for ids the master does not know. */
export function procedureName(id: string | undefined): string | undefined {
  if (!id) return undefined;
  return getProcedure(id)?.name.ko ?? id;
}

/** clinic id -> Korean display name, for screens that only hold ids (rules, signals, log). */
export async function clinicNames(store: Store): Promise<Record<string, string>> {
  const registry = await store.list<ClinicRegistryEntry>("platform", PLATFORM_COLLECTIONS.registry);
  return Object.fromEntries(registry.map((entry) => [entry.id, clinicDisplayName(entry, entry.id)]));
}
