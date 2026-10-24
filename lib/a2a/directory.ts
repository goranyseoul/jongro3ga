import type { ClinicRegistryEntry } from "../domain";
import { getStore } from "../store";
import { COLLECTIONS } from "../store/collections";
import type { StoredAgentIdentity } from "./auth";
import type { ClinicCardInput } from "./cards";

// Who answers at an A2A URL. The routes under app/a2a use this to build cards and to 404 unknown agents.
// The clinic registry is the platform's (seeded by WP1); the A2A layer only reads it to serve clinic cards.

/** The registry entry behind /a2a/clinics/{slug}, or undefined when no clinic has that slug. */
export async function resolveClinic(slug: string): Promise<ClinicRegistryEntry | undefined> {
  const [entry] = await getStore().list<ClinicRegistryEntry>("platform", COLLECTIONS.platform.clinicRegistry, { slug });
  return entry;
}

export async function resolveClinicCardInput(slug: string): Promise<ClinicCardInput | undefined> {
  return resolveClinic(slug);
}

/** A registered customer agent ("cag_..."), or undefined. Other roles with the same id do not count. */
export async function resolveCustomerAgent(agentId: string): Promise<StoredAgentIdentity | undefined> {
  const identity = await getStore().get<StoredAgentIdentity>("shared", COLLECTIONS.shared.agentIdentities, agentId);
  return identity?.role === "customer" ? identity : undefined;
}
