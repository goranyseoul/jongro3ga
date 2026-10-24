import type { ClinicBookingRecord } from "../agents/clinic/store";
import { getProcedure } from "../domain/procedure-master";
import type { ProxyBooking } from "../ui-data/ops";

// Maps agent records to the shapes the ops screens already render (lib/ui-data/ops.ts types).

/** A pending proxy booking as a row of /ops/proxy-queue. */
export function toProxyBooking(record: ClinicBookingRecord): ProxyBooking {
  const procedure = getProcedure(record.procedureId);
  return {
    id: record.id,
    clinicId: record.clinicId,
    guest: {
      displayName: record.request.guest.displayName,
      agentId: record.customerAgentId,
      language: record.request.guest.language,
    },
    procedure: procedure?.name.ko ?? record.procedureId,
    amountText: procedure?.unit ? `견적 기준 (${procedure.unit})` : "견적 기준",
    priceKrw: record.priceKrw,
    vatIncluded: true,
    slot: record.request.slot,
    requestedAt: record.createdAt,
    state: record.status === "confirmed" ? "confirmed" : record.status === "canceled" ? "rejected" : "waiting_clinic",
  };
}
