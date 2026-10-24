// Loads data/seed/*.json into a store (boot, demo reset). OWNER: track A2A core.
import type { Store } from "@/lib/store/types";

export async function loadSeed(_store: Store): Promise<{ loaded: Record<string, number> }> {
  throw new Error("seed loader not implemented yet (track A2A core)");
}
