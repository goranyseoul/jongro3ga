"use client";

import { useSyncExternalStore } from "react";
import { DEMO_ACCOUNTS, DEMO_NOW, type DemoAccount, type IsoDateTime } from "@/lib/ui-data/customer";

// Mock sign-in for the customer web app until the backend has accounts (06-data-model.md CustomerAccount).
// The session lives in this browser only, next to demo-state. Reads and writes never throw.
// Shared contract for the header account menu, /[locale]/login, /[locale]/signup and /[locale]/me.

export type Session = {
  /** A DEMO_ACCOUNTS id, or "cus_email" for an email signup. */
  accountId: string;
  email?: string;
  displayName: string;
  signedInAt: IsoDateTime;
};

const KEY = "pibu.customer.session.v1";

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedSession: Session | null = null;

function read(): Session | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === cachedRaw) return cachedSession;
    cachedRaw = raw;
    cachedSession = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    cachedRaw = null;
    cachedSession = null;
  }
  return cachedSession;
}

function write(next: Session | null): void {
  try {
    if (next) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
    cachedRaw = next ? JSON.stringify(next) : null;
  } catch {
    // storage blocked: keep the session in memory for this page view
    cachedRaw = null;
  }
  cachedSession = next;
  listeners.forEach((listener) => listener());
}

/** Signs in as a demo account, or as an email account (any address is accepted in the demo). */
export function signIn(input: { accountId: string } | { email: string }): Session {
  const account = "accountId" in input ? DEMO_ACCOUNTS.find((a) => a.id === input.accountId) : undefined;
  const session: Session = account
    ? { accountId: account.id, displayName: account.displayName, signedInAt: DEMO_NOW }
    : {
        accountId: "cus_email",
        email: "email" in input ? input.email : undefined,
        displayName: "email" in input ? input.email.split("@")[0] : "guest",
        signedInAt: DEMO_NOW,
      };
  write(session);
  return session;
}

export function signOut(): void {
  write(null);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The signed-in session, or null. Server render and the first client render see null, so hydration
 * always matches; screens that need an account should render a signed-out state first, not redirect
 * during render.
 */
export function useSession(): { session: Session | null; account: DemoAccount | undefined } {
  const session = useSyncExternalStore(subscribe, read, () => null);
  return { session, account: session ? DEMO_ACCOUNTS.find((a) => a.id === session.accountId) : undefined };
}
