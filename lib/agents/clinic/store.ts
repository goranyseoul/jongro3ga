import type { QuoteV1 } from "../../a2a/schemas";
import type {
  ClinicBooking,
  ClinicProfile,
  ClinicTask,
  IsoDateTime,
  Krw,
  MenuItem,
  Offer,
  Slot,
  SlotPolicy,
} from "../../domain";
import { getStore } from "../../store";
import { COLLECTIONS } from "../../store/collections";

// The clinic agent's view of the store: the `clinic` namespace only (09-architecture.md "모듈 경계",
// scripts/check-boundaries.mjs). Every read and write of lib/agents/clinic goes through this file.

const K = COLLECTIONS.clinic;

/**
 * ClinicBooking (06) plus what the clinic needs to answer later without the original request in hand.
 * - `customerAgentId`: the agent that sent clinic.book. The SDK task store scopes tasks by caller, so the
 *   confirmation must write the task back as this agent (BUILD-LOG 19 (4)).
 * - `referralToken`, `priceKrw`, `procedureId`: pibu/booking@1 needs them and the booking request has none.
 * - `inputRequested` / `inputValues`: the one P0 input-request round (passport name, last Rejuran date).
 */
export interface ClinicBookingRecord extends ClinicBooking {
  customerAgentId: string;
  referralToken: string;
  priceKrw: Krw;
  procedureId: string;
  /** Field keys asked for with TASK_STATE_INPUT_REQUIRED and not answered yet. */
  inputRequested?: string[];
  inputValues?: Record<string, string>;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

/** ClinicTask (06) plus the quote it produced, so clinic.book can find the price behind a quoteId. */
export interface ClinicTaskRecord extends ClinicTask {
  quote?: QuoteV1;
}

type StoredSlotPolicy = SlotPolicy & { id: string };

// ---- profile, menu, offers ----

export async function getProfile(clinicId: string): Promise<ClinicProfile | undefined> {
  return getStore().get<ClinicProfile>("clinic", K.profiles, clinicId);
}

export async function putProfile(profile: ClinicProfile): Promise<void> {
  await getStore().put("clinic", K.profiles, profile);
}

export async function listMenu(clinicId: string): Promise<MenuItem[]> {
  return getStore().list<MenuItem>("clinic", K.menuItems, { clinicId });
}

export async function putMenuItem(item: MenuItem): Promise<void> {
  await getStore().put("clinic", K.menuItems, item);
}

export async function removeMenuItem(id: string): Promise<void> {
  await getStore().remove("clinic", K.menuItems, id);
}

export async function listOffers(clinicId: string): Promise<Offer[]> {
  return getStore().list<Offer>("clinic", K.offers, { clinicId });
}

export async function putOffer(offer: Offer): Promise<void> {
  await getStore().put("clinic", K.offers, offer);
}

// ---- slots ----

export async function getSlotPolicy(clinicId: string): Promise<SlotPolicy | undefined> {
  const stored = await getStore().get<StoredSlotPolicy>("clinic", K.slotPolicies, clinicId);
  if (!stored) return undefined;
  const { id, ...policy } = stored;
  void id;
  return policy;
}

export async function putSlotPolicy(policy: SlotPolicy): Promise<void> {
  await getStore().put<StoredSlotPolicy>("clinic", K.slotPolicies, { id: policy.clinicId, ...policy });
}

export async function listSlots(clinicId: string): Promise<Slot[]> {
  return getStore().list<Slot>("clinic", K.slots, { clinicId });
}

export async function getSlot(id: string): Promise<Slot | undefined> {
  return getStore().get<Slot>("clinic", K.slots, id);
}

export async function putSlot(slot: Slot): Promise<void> {
  await getStore().put("clinic", K.slots, slot);
}

/** Holds or frees the clinic's slot that starts at `start` (same instant, any offset notation). */
export async function setSlotHeld(clinicId: string, start: IsoDateTime, held: boolean): Promise<void> {
  const at = Date.parse(start);
  for (const slot of await listSlots(clinicId)) {
    if (Date.parse(slot.start) === at && slot.held !== held) await putSlot({ ...slot, held });
  }
}

// ---- bookings ----

export async function getBooking(id: string): Promise<ClinicBookingRecord | undefined> {
  return getStore().get<ClinicBookingRecord>("clinic", K.bookings, id);
}

export async function listBookings(filter: Partial<ClinicBookingRecord> = {}): Promise<ClinicBookingRecord[]> {
  return getStore().list<ClinicBookingRecord>("clinic", K.bookings, filter);
}

export async function findBookingByTask(clinicId: string, a2aTaskId: string): Promise<ClinicBookingRecord | undefined> {
  const [found] = await listBookings({ clinicId, a2aTaskId });
  return found;
}

export async function putBooking(booking: ClinicBookingRecord): Promise<void> {
  await getStore().put("clinic", K.bookings, booking);
}

// ---- task journal ----

export const clinicTaskId = (clinicId: string, a2aTaskId: string): string => `${clinicId}:${a2aTaskId}`;

export async function putClinicTask(task: ClinicTaskRecord): Promise<void> {
  await getStore().put("clinic", K.tasks, task);
}

export async function getClinicTask(clinicId: string, a2aTaskId: string): Promise<ClinicTaskRecord | undefined> {
  return getStore().get<ClinicTaskRecord>("clinic", K.tasks, clinicTaskId(clinicId, a2aTaskId));
}

export async function listClinicTasks(filter: Partial<ClinicTaskRecord> = {}): Promise<ClinicTaskRecord[]> {
  return getStore().list<ClinicTaskRecord>("clinic", K.tasks, filter);
}

/** The quote this clinic issued under `quoteId`, from the task journal. */
export async function findIssuedQuote(clinicId: string, quoteId: string): Promise<QuoteV1 | undefined> {
  const tasks = await listClinicTasks({ clinicId, skillId: "clinic.quote" });
  return tasks.find((task) => task.quote?.quoteId === quoteId)?.quote;
}
