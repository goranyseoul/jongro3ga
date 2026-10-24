import { getConsoleClinic } from "@/lib/agents/clinic/console";
import { withClinic } from "../_shared";

export async function GET(request: Request) {
  return withClinic(request, (clinicId) => getConsoleClinic(clinicId));
}
