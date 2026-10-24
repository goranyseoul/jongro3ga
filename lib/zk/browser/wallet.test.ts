import { describe, expect, it } from "vitest";
import {
  WALLET_STORAGE_KEY,
  createWallet,
  isBrowserWallet,
  loadOrCreateWallet,
  randomSalt,
  recordCount,
  resetWallet,
  type WalletStorage,
} from "./wallet";

const FIELD_MODULUS = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

const memoryStorage = (): WalletStorage & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => void map.set(key, value) };
};

describe("browser wallet", () => {
  it("creates an empty 8-slot chart under a random 32-byte pseudonym", () => {
    const wallet = createWallet(new Date("2026-10-24T00:00:00Z"));
    expect(wallet.subjectId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(wallet.chart.types).toEqual(Array(8).fill(0));
    expect(wallet.chart.dates).toEqual(Array(8).fill(0));
    expect(wallet.chart.clinics).toEqual(Array(8).fill(0));
    expect(recordCount(wallet.chart)).toBe(0);
    expect(wallet.createdAt).toBe("2026-10-24T00:00:00.000Z");
    expect(isBrowserWallet(wallet)).toBe(true);
  });

  it("keeps the salt a decimal field element", () => {
    for (let i = 0; i < 50; i++) {
      const salt = randomSalt();
      expect(salt).toMatch(/^\d+$/);
      expect(BigInt(salt) < FIELD_MODULUS).toBe(true);
    }
  });

  it("stores the wallet on first use and returns the same one afterwards", () => {
    const storage = memoryStorage();
    const first = loadOrCreateWallet(storage);
    expect(JSON.parse(storage.map.get(WALLET_STORAGE_KEY) ?? "null")).toEqual(first);
    expect(loadOrCreateWallet(storage)).toEqual(first);
  });

  it("replaces an unreadable or tampered entry instead of trusting it", () => {
    const storage = memoryStorage();
    storage.setItem(WALLET_STORAGE_KEY, "{not json");
    expect(isBrowserWallet(loadOrCreateWallet(storage))).toBe(true);

    const wallet = createWallet();
    storage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ ...wallet, chart: { ...wallet.chart, types: [1, 2] } }));
    expect(loadOrCreateWallet(storage).subjectId).not.toBe(wallet.subjectId);

    storage.setItem(WALLET_STORAGE_KEY, JSON.stringify({ ...wallet, chart: { ...wallet.chart, salt: FIELD_MODULUS.toString() } }));
    expect(loadOrCreateWallet(storage).subjectId).not.toBe(wallet.subjectId);
  });

  it("reset starts over under a new pseudonym", () => {
    const storage = memoryStorage();
    const first = loadOrCreateWallet(storage);
    const next = resetWallet(storage);
    expect(next.subjectId).not.toBe(first.subjectId);
    expect(next.chart.salt).not.toBe(first.chart.salt);
    expect(loadOrCreateWallet(storage)).toEqual(next);
  });
});
