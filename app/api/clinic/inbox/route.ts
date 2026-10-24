import { getInbox } from "@/lib/agents/clinic/console";
import { withClinic } from "../_shared";

export async function GET(request: Request) {
  return withClinic(request, async (clinicId) => ({ tasks: await getInbox(clinicId) }));
}
