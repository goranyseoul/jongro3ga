import type { ZkChart } from "../../domain/zk";
import { N } from "../clauses";

// The on-device record wallet (docs/INTEGRATION.md 8, roadmap T18): pseudonym, chart and salt live in this
// browser's localStorage and nowhere else. Nothing in this module touches the network.

export const WALLET_STORAGE_KEY = "pibook.zk.wallet.v1";

/** BN254 scalar field modulus: every circuit input, the salt included, must be below it. */
const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export interface BrowserWallet {
  /** Pseudonym on the registry: 0x followed by 64 hex digits. Never anchored until a clinic confirms a visit. */
  subjectId: string;
  chart: ZkChart;
  /** ISO timestamp of the pseudonym's creation. */
  createdAt: string;
}

/** The part of the Storage API the wallet needs, so tests can pass an in-memory map. */
export type WalletStorage = Pick<Storage, "getItem" | "setItem">;

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
const randomBytes = (length: number): Uint8Array => crypto.getRandomValues(new Uint8Array(length));

/** 32 random bytes: the registry key for this wallet. */
export const randomSubjectId = (): string => `0x${toHex(randomBytes(32))}`;

/** 31 random bytes (248 bits) as a decimal string: always below the field modulus, like chain/records.mjs rand(). */
export const randomSalt = (): string => BigInt(`0x${toHex(randomBytes(31))}`).toString(10);

/** A fresh pseudonym starts from the empty chart (all 8 slots 0), the same rule the append circuit enforces. */
export const emptyChart = (): ZkChart => ({
  types: Array<number>(N).fill(0),
  dates: Array<number>(N).fill(0),
  clinics: Array<number>(N).fill(0),
  salt: randomSalt(),
});

export const createWallet = (now: Date = new Date()): BrowserWallet => ({
  subjectId: randomSubjectId(),
  chart: emptyChart(),
  createdAt: now.toISOString(),
});

/** Clinic-confirmed records in the chart (slot type 0 means empty). */
export const recordCount = (chart: ZkChart): number => chart.types.filter((type) => type !== 0).length;

const isSlotArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.length === N && value.every((slot) => Number.isSafeInteger(slot) && slot >= 0);

const isSalt = (value: unknown): value is string =>
  typeof value === "string" && /^\d{1,78}$/.test(value) && BigInt(value) < FIELD_MODULUS;

/** Shape check for whatever is in localStorage: an edited or older entry is replaced, never trusted. */
export function isBrowserWallet(value: unknown): value is BrowserWallet {
  if (typeof value !== "object" || value === null) return false;
  const wallet = value as Partial<BrowserWallet>;
  const chart = wallet.chart as Partial<ZkChart> | undefined;
  return (
    typeof wallet.subjectId === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(wallet.subjectId) &&
    typeof wallet.createdAt === "string" &&
    typeof chart === "object" &&
    chart !== null &&
    isSlotArray(chart.types) &&
    isSlotArray(chart.dates) &&
    isSlotArray(chart.clinics) &&
    isSalt(chart.salt)
  );
}

const browserStorage = (): WalletStorage => window.localStorage;

function save(storage: WalletStorage, wallet: BrowserWallet): BrowserWallet {
  storage.setItem(WALLET_STORAGE_KEY, JSON.stringify(wallet));
  return wallet;
}

/** Returns the wallet stored in this browser, creating (and storing) a fresh pseudonym on first use. */
export function loadOrCreateWallet(storage: WalletStorage = browserStorage()): BrowserWallet {
  const raw = storage.getItem(WALLET_STORAGE_KEY);
  if (raw !== null) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isBrowserWallet(parsed)) return parsed;
    } catch {
      // unreadable entry: fall through and replace it
    }
  }
  return save(storage, createWallet());
}

/** Drops the current pseudonym and chart and starts over under a new one. */
export function resetWallet(storage: WalletStorage = browserStorage()): BrowserWallet {
  return save(storage, createWallet());
}
