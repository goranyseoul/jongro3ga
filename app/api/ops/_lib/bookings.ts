// Booking rows for the proxy queue and the demo side panel. Bookings live in the clinic agent's store
// (ClinicBooking, `clinic` namespace); what the operator needs to see beside them (procedure, amount,
// price, who asked and when) comes from the shared A2A log, so no other agent's data is read.
import { taskArtifactData, taskFromSendMessageResult } from "../../../../lib/a2a/wire";
import { listA2ALog } from "../../../../lib/a2a/log";
import type { ClinicBooking, ClinicProfile } from "../../../../lib/domain/clinic";
import type { ClinicRegistryEntry } from "../../../../lib/domain/platform";
import type { A2ALogEntry } from "../../../../lib/domain/shared";
import type { Store } from "../../../../lib/store/types";
import { PLATFORM_COLLECTIONS, clinicDisplayName } from "../../../../lib/agents/platform/signals";

/** Collection names in the `clinic` namespace, written by the clinic agent (track CLINIC). */
export const CLINIC_COLLECTIONS = { bookings: "bookings", profiles: "profiles" } as const;

export interface QuoteSummary {
  procedureId?: string;
  product?: string;
  amount?: { value: number; unit: string };
  priceKrw?: number;
  vatIncluded?: boolean;
}

export interface BookingRow {
  bookingId: string;
  clinicId: string;
  clinicName: string;
  operationMode: "proxy" | "clinic";
  status: ClinicBooking["status"];
  confirmedBy?: ClinicBooking["confirmedBy"];
  slot: string;
  requestId: string;
  quoteId: string;
  a2aTaskId: string;
  guest: { displayName: string; language: string; agentId?: string };
  /** From the clinic.quote answer for this quoteId, when it is in the log. */
  quote?: QuoteSummary;
  requestedAt?: string;
  resolvedAt?: string;
}

function quoteData(entry: A2ALogEntry): Record<string, unknown> | undefined {
  const result = (entry.response as { result?: unknown } | undefined)?.result;
  const task = taskFromSendMessageResult(result);
  return task ? taskArtifactData(task) : undefined;
}

export async function loadBookingRows(store: Store): Promise<BookingRow[]> {
  const [bookings, profiles, registry, log] = await Promise.all([
    store.list<ClinicBooking>("clinic", CLINIC_COLLECTIONS.bookings),
    store.list<ClinicProfile>("clinic", CLINIC_COLLECTIONS.profiles),
    store.list<ClinicRegistryEntry>("platform", PLATFORM_COLLECTIONS.registry),
    listA2ALog(store),
  ]);
  const registryById = new Map(registry.map((entry) => [entry.id, entry]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  const quotes = new Map<string, Record<string, unknown>>();
  const bookCalls = new Map<string, A2ALogEntry>();
  const reports = new Map<string, A2ALogEntry>();
  for (const entry of log) {
    if (entry.skillId === "clinic.quote") {
      const data = quoteData(entry);
      if (typeof data?.quoteId === "string") quotes.set(data.quoteId, data);
    }
    if (entry.skillId === "clinic.book" && entry.taskId) bookCalls.set(entry.taskId, entry);
    if (entry.skillId === "platform.report_booking") {
      const bookingId = (entry.request as { params?: { message?: { parts?: { data?: { bookingId?: unknown } }[] } } })?.params?.message?.parts?.find((part) => part.data)?.data?.bookingId;
      if (typeof bookingId === "string") reports.set(bookingId, entry);
    }
  }

  return bookings
    .map((booking): BookingRow => {
      const entry = registryById.get(booking.clinicId);
      const profile = profileById.get(booking.clinicId);
      const quote = quotes.get(booking.request.quoteId);
      const call = bookCalls.get(booking.a2aTaskId);
      return {
        bookingId: booking.id,
        clinicId: booking.clinicId,
        clinicName: clinicDisplayName(entry ?? profile, booking.clinicId),
        operationMode: entry?.operationMode ?? profile?.operationMode ?? "clinic",
        status: booking.status,
        ...(booking.confirmedBy ? { confirmedBy: booking.confirmedBy } : {}),
        slot: booking.request.slot,
        requestId: booking.request.requestId,
        quoteId: booking.request.quoteId,
        a2aTaskId: booking.a2aTaskId,
        guest: {
          displayName: booking.request.guest.displayName,
          language: booking.request.guest.language,
          ...(call?.from.role === "customer" ? { agentId: call.from.agentId } : {}),
        },
        ...(quote
          ? {
              quote: {
                procedureId: quote.procedureId as string | undefined,
                product: quote.product as string | undefined,
                amount: quote.amount as QuoteSummary["amount"],
                priceKrw: quote.priceKrw as number | undefined,
                vatIncluded: quote.vatIncluded as boolean | undefined,
              },
            }
          : {}),
        ...(call ? { requestedAt: call.at } : {}),
        ...(reports.get(booking.id) ? { resolvedAt: reports.get(booking.id)?.at } : {}),
      };
    })
    .sort((a, b) => (a.requestedAt ?? a.slot).localeCompare(b.requestedAt ?? b.slot));
}

export async function findBooking(store: Store, bookingId: string): Promise<ClinicBooking | undefined> {
  return store.get<ClinicBooking>("clinic", CLINIC_COLLECTIONS.bookings, bookingId);
}

/** Who confirms a booking: the operator for proxy clinics, the clinic's staff for direct ones (05 demo control). */
export async function operationModeOf(store: Store, clinicId: string): Promise<"proxy" | "clinic"> {
  const entry = await store.get<ClinicRegistryEntry>("platform", PLATFORM_COLLECTIONS.registry, clinicId);
  if (entry) return entry.operationMode;
  const profile = await store.get<ClinicProfile>("clinic", CLINIC_COLLECTIONS.profiles, clinicId);
  return profile?.operationMode ?? "clinic";
}
