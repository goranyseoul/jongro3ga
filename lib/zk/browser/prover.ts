import type { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import type { CompiledCircuit, InputMap, Noir } from "@noir-lang/noir_js";
import type { OfferProofV1, ZkClause } from "../../a2a/schemas";
import type { ZkChart } from "../../domain/zk";
import { toCircuitClause } from "../clauses";

// In-browser prover (roadmap T18): the same circuits and the same noir_js + bb.js versions as chain/records.mjs,
// compiled to WASM. Everything heavy is behind dynamic import(), so only the page that proves downloads it:
//   noir_js (witness generation, about 3 MB of WASM) for the chart hash,
//   bb.js (UltraHonk prover, about 3.7 MB of inlined WASM plus a worker) only when a proof is requested.
// Single-threaded by default so no COOP/COEP headers are needed; multithreading needs crossOriginIsolated.

export type OfferProof = OfferProofV1["proofs"][number];

export interface OfferProofResult {
  proofs: OfferProof[];
  /** Proving time only, like the server bundle (the engine load is reported by warmUpProver). */
  provingMs: number;
}

export interface ProverOptions {
  /** Use every core when the page is crossOriginIsolated; otherwise bb.js stays on one thread. */
  multithread?: boolean;
}

export interface ProverInfo {
  threads: number;
  loadMs: number;
}

/**
 * G1 points fetched from the Aztec CRS CDN (64 bytes each) and cached in IndexedDB. The eligibility circuit is
 * 2^15 gates, so 2^16 points (4 MB) leave headroom; bb.js would otherwise fetch 2^20 points (64 MB).
 */
const SRS_POINTS = 2 ** 16;

interface Circuits {
  commit: Noir;
  eligibility: Noir;
  eligibilityBytecode: string;
}

interface Backend extends ProverInfo {
  api: Barretenberg;
  eligibility: UltraHonkBackend;
}

let circuits: Promise<Circuits> | undefined;
let backend: Promise<Backend> | undefined;

/** What the prover needs from the browser. A false result means "browser proving not supported here". */
export function browserProofSupport(): { ok: true } | { ok: false; reason: string } {
  if (typeof window === "undefined") return { ok: false, reason: "서버 렌더링 중" };
  if (typeof WebAssembly !== "object") return { ok: false, reason: "WebAssembly 없음" };
  if (typeof Worker === "undefined") return { ok: false, reason: "Web Worker 없음" };
  if (typeof indexedDB === "undefined") return { ok: false, reason: "IndexedDB 없음 (CRS 캐시)" };
  return { ok: true };
}

const asCircuit = (artifact: unknown): CompiledCircuit => artifact as CompiledCircuit;

function loadCircuits(): Promise<Circuits> {
  circuits ??= (async () => {
    const [{ Noir }, commit, eligibility] = await Promise.all([
      import("@noir-lang/noir_js"),
      import("../../../zk/commit/target/commit.json"),
      import("../../../zk/eligibility/target/eligibility.json"),
    ]);
    return {
      commit: new Noir(asCircuit(commit.default)),
      eligibility: new Noir(asCircuit(eligibility.default)),
      eligibilityBytecode: eligibility.default.bytecode,
    };
  })().catch((error: unknown) => {
    circuits = undefined;
    throw error;
  });
  return circuits;
}

function loadBackend(options: ProverOptions): Promise<Backend> {
  backend ??= (async () => {
    const started = performance.now();
    const [bb, loaded] = await Promise.all([import("@aztec/bb.js"), loadCircuits()]);
    // bb.js sizes the CRS download from this method; the circuits here never need more than SRS_POINTS.
    bb.Barretenberg.prototype.getDefaultSrsSize = () => SRS_POINTS;
    const threads =
      options.multithread && window.crossOriginIsolated ? Math.max(1, navigator.hardwareConcurrency || 1) : 1;
    const api = await bb.Barretenberg.new({ backend: bb.BackendType.WasmWorker, threads });
    return {
      api,
      eligibility: new bb.UltraHonkBackend(loaded.eligibilityBytecode, api),
      threads,
      loadMs: Math.round(performance.now() - started),
    };
  })().catch((error: unknown) => {
    backend = undefined;
    throw error;
  });
  return backend;
}

const decimal = (value: number | string): string => String(value);

/** Circuit inputs as decimal strings, exactly like chainInput() in chain/records.mjs. */
const chartInput = (chart: ZkChart): InputMap => ({
  types: chart.types.map(decimal),
  dates: chart.dates.map(decimal),
  clinics: chart.clinics.map(decimal),
  salt: chart.salt,
});

/** A field element as 0x followed by 64 hex digits (the registry's bytes32 form). */
const toField32 = (value: unknown): string => {
  if (typeof value !== "string" && typeof value !== "number") throw new Error("commit circuit returned no field");
  return `0x${BigInt(value).toString(16).padStart(64, "0")}`;
};

const bytesToHex = (bytes: Uint8Array): string =>
  `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;

/** Pedersen commitment of the chart (commit circuit): what the registry would hold once anchored. */
export async function commitmentOf(chart: ZkChart): Promise<string> {
  const { commit } = await loadCircuits();
  const { returnValue } = await commit.execute(chartInput(chart));
  return toField32(returnValue);
}

/** Loads bb.js and the CRS ahead of the first proof. Safe to call more than once. */
export async function warmUpProver(options: ProverOptions = {}): Promise<ProverInfo> {
  const { threads, loadMs } = await loadBackend(options);
  return { threads, loadMs };
}

/**
 * One UltraHonk proof per clause, all against the same commitment (chain/records.mjs proveOffer).
 * Public inputs come back in circuit order: commitment, today, type, clinic, min_days, max_days, min_count, max_count.
 * Throws "Cannot satisfy constraint" when the chart does not meet a clause, so match on the device first.
 */
export async function proveOffer(
  chart: ZkChart,
  commitmentHex: string,
  today: number,
  clauses: readonly ZkClause[],
  options: ProverOptions = {},
): Promise<OfferProofResult> {
  const [{ eligibility }, prover] = await Promise.all([loadCircuits(), loadBackend(options)]);
  const started = performance.now();
  const proofs: OfferProof[] = [];
  for (const clause of clauses) {
    const c = toCircuitClause(clause);
    const { witness } = await eligibility.execute({
      ...chartInput(chart),
      commitment: commitmentHex,
      today: decimal(today),
      target_type: decimal(c.target_type),
      target_clinic: decimal(c.target_clinic),
      min_days: decimal(c.min_days),
      max_days: decimal(c.max_days),
      min_count: decimal(c.min_count),
      max_count: decimal(c.max_count),
    });
    const { proof, publicInputs } = await prover.eligibility.generateProof(witness);
    proofs.push({ proof: bytesToHex(proof), publicInputs });
  }
  return { proofs, provingMs: Math.round(performance.now() - started) };
}

/** Terminates the bb.js worker. The next proof loads it again. */
export async function disposeProver(): Promise<void> {
  const current = backend;
  backend = undefined;
  if (!current) return;
  try {
    await (await current).api.destroy();
  } catch {
    // a backend that failed to load has nothing to destroy
  }
}
