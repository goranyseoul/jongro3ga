import { deleteOffer } from "@/lib/agents/clinic/console";
import { withClinic } from "../../_shared";

export async function DELETE(request: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  return withClinic(request, (clinicId) => deleteOffer(clinicId, offerId));
}
