"use client";

import { createLocalStore } from "@/lib/local-store";
import { OPERATOR_ACCOUNTS, OPS_NOW, type OperatorAccount, type OperatorRole } from "@/lib/ui-data/ops";

// Mock sign-in for the ops console until the platform has operator accounts. Browser only.
// Shared contract for the shell account menu, /ops/login and /ops/account.

export type OpsSession = {
  /** An OPERATOR_ACCOUNTS id, or "opr_email" for an email sign-in. */
  operatorId: string;
  name: string;
  email: string;
  role: OperatorRole;
  signedInAt: string;
};

export const OPS_LOGIN_PATH = "/ops/login";
export const OPS_HOME_PATH = "/ops/clinics";

const store = createLocalStore<OpsSession>("pibu.ops.session.v1");

/** Signs in as a demo operator, or with any email and password (an unknown email gets view-only access). */
export function signInOps(input: { operatorId: string } | { email: string }): OpsSession {
  const email = "email" in input ? input.email.trim() : "";
  const account =
    "operatorId" in input
      ? OPERATOR_ACCOUNTS.find((a) => a.id === input.operatorId)
      : OPERATOR_ACCOUNTS.find((a) => a.email.toLowerCase() === email.toLowerCase());
  const session: OpsSession = account
    ? { operatorId: account.id, name: account.name, email: account.email, role: account.role, signedInAt: OPS_NOW }
    : { operatorId: "opr_email", name: email.split("@")[0] || email, email, role: "viewer", signedInAt: OPS_NOW };
  store.write(session);
  return session;
}

export function signOutOps(): void {
  store.write(null);
}

/** Null on the server and the first client render; never redirect on null, show a signed-out state. */
export function useOpsSession(): { session: OpsSession | null; account: OperatorAccount | undefined } {
  const session = store.useValue();
  return { session, account: session ? OPERATOR_ACCOUNTS.find((a) => a.id === session.operatorId) : undefined };
}
