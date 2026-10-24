import type { DefaultExecutionEventBusManager, InMemoryTaskStore } from "@a2a-js/sdk/server";
import type { CryptoKey, JWK } from "jose";
import type { MemoryStore } from "./store/memory";

// Process wide state lives on globalThis so dev server hot reload keeps it (09-architecture.md "SDK 함정" 5).
export interface PibuGlobals {
  store?: MemoryStore;
  /** Fixed demo time in epoch ms, set by setClock. Undefined means "start from the default again". */
  clockAt?: number;
  /** A2A task stores per agent instance ("platform", "clinic:mint", "customer:cag_7f3k2"), lib/a2a/server.ts. */
  taskStores?: Map<string, InMemoryTaskStore>;
  /** Event bus managers per agent instance, so a task kept alive (INPUT_REQUIRED) is found by the next request. */
  eventBusManagers?: Map<string, DefaultExecutionEventBusManager>;
  /** HS256 secret for agent tokens when A2A_TOKEN_SECRET is empty (demo only, lib/a2a/auth.ts). */
  agentTokenSecret?: Uint8Array;
  /** ES256 referral key pair when REFERRAL_*_JWK are empty (demo only, lib/a2a/auth.ts). */
  referralKeys?: { privateKey: CryptoKey; publicKey: CryptoKey; publicJwk: JWK };
  /** Agent Cards fetched by lib/a2a/client.ts, kept 60 seconds. */
  agentCardCache?: Map<string, { fetchedAt: number; card: unknown }>;
}

declare global {
  var __pibu: PibuGlobals | undefined;
}

export function pibuGlobals(): PibuGlobals {
  return (globalThis.__pibu ??= {});
}
