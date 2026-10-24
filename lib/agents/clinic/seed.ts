// Writes clinic seed data into namespace "clinic". data/seed/load.ts (track A2A core) can call
// writeClinicSeed with the clinic part of clinics.json; ensureClinicData is the demo fallback.
import { getStore } from "../../store";
import type { Store } from "../../store/types";
import type { Slot } from "../../domain/clinic";
import { CLINIC_SEED, seedSlots, type ClinicSeed } from "./fixtures";
import { clinicStore } from "./store";

export async function writeClinicSeed(
  store: Store,
  seeds: ClinicSeed[] = CLINIC_SEED,
  slots: Slot[] = seeds.flatMap((seed) => seedSlots(seed.profile.id)),
): Promise<{ clinics: number; menuItems: number; offers: number; slots: number }> {
  const db = clinicStore(store);
  for (const seed of seeds) {
    await db.putProfile(seed.profile);
    await db.putOperation(seed.operation);
    await db.putSlotPolicy(seed.slotPolicy);
    for (const item of seed.menu) await db.putMenuItem(item);
    for (const offer of seed.offers) await db.putOffer(offer);
  }
  for (const slot of slots) await db.putSlot(slot);
  return {
    clinics: seeds.length,
    menuItems: seeds.reduce((sum, seed) => sum + seed.menu.length, 0),
    offers: seeds.reduce((sum, seed) => sum + seed.offers.length, 0),
    slots: slots.length,
  };
}

/**
 * Demo fallback: when DEMO_MODE=true and nothing has seeded the clinic namespace yet, write the 06 seed
 * values so the console and the clinic agent have data. Once the boot seed loader runs, this is a no-op.
 */
export async function ensureClinicData(store: Store = getStore()): Promise<void> {
  if (process.env.DEMO_MODE !== "true") return;
  const db = clinicStore(store);
  if ((await db.profiles()).length > 0) return;
  await writeClinicSeed(store);
}
