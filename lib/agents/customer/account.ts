import type { SessionUser } from "../../auth/session";
import type { CustomerProfile } from "../../domain/customer";
import type { Store } from "../../store/types";
import { DEMO_CUSTOMER_ID, demoProfileByAgentId, ensureDemoCustomer, isDemoCustomerId } from "./seed";
import { C, listOf } from "./store";

// Who the customer screens act for. The signed-in account (AUTH track) gives the pseudonymous agent id;
// signed out, demo mode falls back to Yuki (or the persona picked with the demo cookie).

export const DEMO_PERSONA_COOKIE = "pibu_demo_customer";

export type CustomerIdentity =
  | { kind: "customer"; profile: CustomerProfile; demo: boolean }
  /** Signed in, but onboarding has not written a profile yet. */
  | { kind: "needs_onboarding"; agentId: string }
  | { kind: "signed_out" };

export function demoMode(): boolean {
  return process.env.DEMO_MODE === "true";
}

export async function profileByAgentId(store: Store, agentId: string): Promise<CustomerProfile | undefined> {
  const [found] = await listOf<CustomerProfile>(store, C.profiles, { agentId });
  if (found) return found;
  // A demo profile is created on first use so seeded agent ids always resolve.
  const demo = demoProfileByAgentId(agentId);
  return demo ? ensureDemoCustomer(store, demo.id) : undefined;
}

export async function resolveIdentity(
  store: Store,
  user: SessionUser | null,
  demoPersona: string | undefined,
): Promise<CustomerIdentity> {
  if (user?.customerAgentId) {
    const profile = await profileByAgentId(store, user.customerAgentId);
    return profile ? { kind: "customer", profile, demo: false } : { kind: "needs_onboarding", agentId: user.customerAgentId };
  }
  if (!demoMode()) return { kind: "signed_out" };
  const id = demoPersona && isDemoCustomerId(demoPersona) ? demoPersona : DEMO_CUSTOMER_ID;
  const profile = await ensureDemoCustomer(store, id);
  return profile ? { kind: "customer", profile, demo: true } : { kind: "signed_out" };
}
