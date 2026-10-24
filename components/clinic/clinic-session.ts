"use client";

import { createLocalStore } from "@/lib/local-store";
import { CLINIC, CLINIC_ACCOUNTS, NOW, type ClinicAccount, type ClinicStaff, type StaffRole } from "@/lib/ui-data/clinic";

// Mock sign-in for the clinic console until the backend has staff accounts. Browser only.
// Shared contract for the shell account menu, /clinic/login and /clinic/settings.

export type ClinicSession = {
  clinicId: string;
  /** A CLINIC_ACCOUNTS staff id, or "stf_email" for an email sign-in. */
  staffId: string;
  staffName: string;
  role: StaffRole;
  email: string;
  signedInAt: string;
};

export const CLINIC_LOGIN_PATH = "/clinic/login";
export const CLINIC_HOME_PATH = "/clinic/dashboard";

const store = createLocalStore<ClinicSession>("pibu.clinic.session.v1");

/** Signs in as a demo staff member, or with any email and password (the demo accepts both). */
export function signInClinic(input: { clinicId: string; staffId: string } | { email: string }): ClinicSession {
  let session: ClinicSession;
  if ("staffId" in input) {
    const clinic = CLINIC_ACCOUNTS.find((c) => c.id === input.clinicId) ?? CLINIC_ACCOUNTS[0];
    const staff = clinic.staff.find((s) => s.id === input.staffId) ?? clinic.staff[0];
    session = { clinicId: clinic.id, staffId: staff.id, staffName: staff.name, role: staff.role, email: staff.email, signedInAt: NOW };
  } else {
    const email = input.email.trim();
    // A known demo email signs in as that person; any other address joins the default clinic.
    const match = CLINIC_ACCOUNTS.flatMap((c) => c.staff.map((s) => ({ clinic: c, staff: s }))).find(
      (entry) => entry.staff.email.toLowerCase() === email.toLowerCase(),
    );
    session = match
      ? { clinicId: match.clinic.id, staffId: match.staff.id, staffName: match.staff.name, role: match.staff.role, email: match.staff.email, signedInAt: NOW }
      : { clinicId: CLINIC.id, staffId: "stf_email", staffName: email.split("@")[0] || email, role: "coordinator", email, signedInAt: NOW };
  }
  store.write(session);
  return session;
}

export function signOutClinic(): void {
  store.write(null);
}

/** Updates the signed-in staff member's display fields (settings save). */
export function updateClinicSession(patch: Partial<Pick<ClinicSession, "staffName" | "email">>): void {
  const current = store.read();
  if (current) store.write({ ...current, ...patch });
}

/** Null on the server and the first client render; never redirect on null, show a signed-out state. */
export function useClinicSession(): { session: ClinicSession | null; clinic: ClinicAccount | undefined; staff: ClinicStaff | undefined } {
  const session = store.useValue();
  const clinic = session ? CLINIC_ACCOUNTS.find((c) => c.id === session.clinicId) : undefined;
  const staff = session ? clinic?.staff.find((s) => s.id === session.staffId) : undefined;
  return { session, clinic, staff };
}
