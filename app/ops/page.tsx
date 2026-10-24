import { redirect } from "next/navigation";

// The overview (/ops) is P1 in 05-screens.md, so the entry point goes to the first P0 screen.
export default function OpsIndexPage() {
  redirect("/ops/clinics");
}
