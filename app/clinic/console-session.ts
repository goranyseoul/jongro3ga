// Server-side helpers for the clinic console pages: which clinic is signed in, and the public base URL.
import { headers } from "next/headers";
import { consoleClinicId, getConsoleClinic } from "@/lib/agents/clinic/console";
import type { ConsoleClinic } from "@/lib/ui-data/clinic";

/** Clinic id of the clinic_staff session, or the demo clinic when signed out in DEMO_MODE. null otherwise. */
export async function currentClinicId(): Promise<string | null> {
  return consoleClinicId(await headers());
}

export async function currentClinic(): Promise<ConsoleClinic | null> {
  const clinicId = await currentClinicId();
  if (!clinicId) return null;
  try {
    return await getConsoleClinic(clinicId);
  } catch {
    return null;
  }
}

/** PUBLIC_BASE_URL when set, otherwise the host this request came in on. */
export async function requestBaseUrl(): Promise<string> {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL.replace(/\/$/, "");
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}
