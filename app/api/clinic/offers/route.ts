import { saveOffer } from "@/lib/agents/clinic/console";
import type { Offer } from "@/lib/ui-data/clinic";
import { readJson, withClinic } from "../_shared";

/** Adds an event, or edits one when the body carries an existing id. */
export async function POST(request: Request) {
  return withClinic(request, async (clinicId) => saveOffer(clinicId, (await readJson(request)) as Partial<Offer>));
}
