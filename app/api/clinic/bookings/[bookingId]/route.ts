import { ConsoleError, decideBooking } from "@/lib/agents/clinic/console";
import type { BookingDecision } from "@/lib/ui-data/clinic";
import { readJson, withClinic } from "../../_shared";

function decisionOf(body: Record<string, unknown>): BookingDecision {
  switch (body.action) {
    case "confirm":
      return { action: "confirm" };
    case "propose":
      if (typeof body.slot !== "string") break;
      return { action: "propose", slot: body.slot };
    case "reject":
      if (typeof body.reason !== "string") break;
      return { action: "reject", reason: body.reason, memo: typeof body.memo === "string" ? body.memo : undefined };
    case "ask":
      if (!Array.isArray(body.fields) || !body.fields.every((field) => typeof field === "string")) break;
      return { action: "ask", fields: body.fields as string[] };
  }
  throw new ConsoleError("action은 confirm, propose(slot), reject(reason), ask(fields) 중 하나여야 해요", 400);
}

/** Confirm, propose another time, reject or ask for information on a pending booking. Returns the new inbox. */
export async function POST(request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return withClinic(request, async (clinicId) => ({ tasks: await decideBooking(clinicId, bookingId, decisionOf(await readJson(request))) }));
}
