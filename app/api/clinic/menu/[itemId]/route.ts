import { saveMenuItem } from "@/lib/agents/clinic/console";
import { readJson, withClinic } from "../../_shared";

/** Price, VAT and inclusions of one menu item. The next clinic.quote answers with the new values. */
export async function PUT(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params;
  return withClinic(request, async (clinicId) => {
    const body = await readJson(request);
    return saveMenuItem(clinicId, itemId, { priceKrw: body.priceKrw, vatIncluded: body.vatIncluded, includes: body.includes });
  });
}
