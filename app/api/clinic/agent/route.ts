import { getAgentView } from "@/lib/agents/clinic/console";
import { baseUrlOf, withClinic } from "../_shared";

export async function GET(request: Request) {
  return withClinic(request, (clinicId) => getAgentView(clinicId, baseUrlOf(request)));
}
