import type { AvailabilityQueryV1, AvailabilityV1 } from "../../a2a/schemas";
import type { IsoDate, IsoDateTime, Slot } from "../../domain";

// clinic.availability and the slot list of clinic.quote (07 견적 규칙 4): every free slot of the clinic
// for the procedure whose day (in Seoul) lies in the window. Pure.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** The Seoul calendar day of an ISO time, whatever offset it was written with. */
export const seoulDay = (at: IsoDateTime): IsoDate => new Date(Date.parse(at) + KST_OFFSET_MS).toISOString().slice(0, 10);

/** Free slots for `procedureId` from `from` to `to` (both days included), earliest first. */
export function openSlots(slots: readonly Slot[], procedureId: string, from: IsoDate, to: IsoDate): IsoDateTime[] {
  return slots
    .filter((slot) => !slot.held && slot.procedureIds.includes(procedureId))
    .filter((slot) => {
      const day = seoulDay(slot.start);
      return from <= day && day <= to;
    })
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .map((slot) => slot.start);
}

export function buildAvailability(input: {
  clinicId: string;
  operationMode: "proxy" | "clinic";
  slots: readonly Slot[];
  query: AvailabilityQueryV1;
}): AvailabilityV1 {
  return {
    schema: "pibu/availability@1",
    clinicId: input.clinicId,
    slots: openSlots(input.slots, input.query.procedureId, input.query.from, input.query.to),
    // A proxy clinic's times are entered weekly by the operator and only indicative (02 "예약 가능 시간").
    indicative: input.operationMode === "proxy",
  };
}
