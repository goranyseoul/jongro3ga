import { clinicsForAutocomplete } from "@/lib/agents/customer/bff";

/** Public clinic names and areas for the 3 second record autocomplete (06: id, name, area only). */
export function GET() {
  return Response.json({ clinics: clinicsForAutocomplete() });
}
