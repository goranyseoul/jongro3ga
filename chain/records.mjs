// Shared record-wallet logic: chart state, append proofs, offer (eligibility) proofs.
// Used by e2e.mjs (local anvil) and seed.mjs (Base Sepolia).
import { readFileSync } from 'node:fs';
import { keccak256, toHex } from 'viem';
import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend, UltraHonkVerifierBackend } from '@aztec/bb.js';

const art = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
export const N = 8, FOREVER = 100000;
export const PROCEDURES = { REJURAN: 1, FILLER: 2, BOTOX: 3, THERMAGE: 4, ULTHERA: 5, EXOSOME: 6, LASER_TONING: 7 };

const s = (x) => x.toString();
export const rand = () => BigInt(keccak256(crypto.getRandomValues(new Uint8Array(32)))) >> 8n; // < field modulus
export const emptyChart = () => ({ types: Array(N).fill(0), dates: Array(N).fill(0), salt: rand() });
const chartInput = (c) => ({ types: c.types.map(s), dates: c.dates.map(s), salt: s(c.salt) });

export async function createProver() {
  const appendCircuit = art('../zk/append/target/append.json');
  const eligCircuit = art('../zk/eligibility/target/eligibility.json');
  const api = await Barretenberg.new();
  const appendNoir = new Noir(appendCircuit), eligNoir = new Noir(eligCircuit);
  const commitNoir = new Noir(art('../zk/commit/target/commit.json'));
  const recordHashNoir = new Noir(art('../zk/record_hash/target/record_hash.json'));
  const appendBackend = new UltraHonkBackend(appendCircuit.bytecode, api);
  const eligBackend = new UltraHonkBackend(eligCircuit.bytecode, api);
  const eligVk = await eligBackend.getVerificationKey();
  const verifier = new UltraHonkVerifierBackend(api);

  const commitmentOf = async (c) => (await commitNoir.execute(chartInput(c))).returnValue;

  return {
    commitmentOf,
    destroy: () => api.destroy(),

    /** Wallet side: build the next chart + EVM append proof for one clinic-issued record. */
    async proveAppend(chart, onchainOld, type, day) {
      const slot = chart.types.findIndex((t) => t === 0);
      if (slot < 0) throw new Error('chart full');
      const next = { types: [...chart.types], dates: [...chart.dates], salt: rand() };
      next.types[slot] = type;
      next.dates[slot] = day;
      const recordNonce = rand(); // shared with the issuing clinic only
      const recordHash = (await recordHashNoir.execute({ new_type: s(type), new_date: s(day), record_nonce: s(recordNonce) })).returnValue;
      const newCommitment = await commitmentOf(next);
      const { witness } = await appendNoir.execute({
        old_types: chart.types.map(s), old_dates: chart.dates.map(s), old_salt: s(chart.salt),
        new_salt: s(next.salt), slot: s(slot), new_type: s(type), record_nonce: s(recordNonce),
        old_commitment: onchainOld, new_commitment: newCommitment, record_hash: recordHash, new_date: s(day),
      });
      const proof = await appendBackend.generateProof(witness, { verifierTarget: 'evm' });
      return { next, newCommitment, recordHash, recordNonce, proofHex: toHex(proof.proof) };
    },

    /** Wallet side: one proof per clause, all against the same on-chain commitment. */
    async proveOffer(chart, commitment, today, clauses) {
      const proofs = [];
      for (const cond of clauses) {
        const { witness } = await eligNoir.execute({ ...chartInput(chart), commitment, today: s(today), ...mapClause(cond) });
        proofs.push(await eligBackend.generateProof(witness));
      }
      return proofs;
    },

    /** Clinic side: verification key + public inputs only. */
    async verifyOffer(proofs, commitment, today, clauses) {
      if (proofs.length !== clauses.length) return false;
      for (const [i, p] of proofs.entries()) {
        const c = mapClause(clauses[i]);
        const expected = [commitment, today, c.target_type, c.min_days, c.max_days, c.min_count, c.max_count].map((v) => BigInt(v));
        if (p.publicInputs.length !== expected.length || p.publicInputs.some((v, j) => BigInt(v) !== expected[j])) return false;
        if (!(await verifier.verifyProof({ ...p, verificationKey: eligVk }))) return false;
      }
      return true;
    },
  };
}

/** Clause shorthand: { type, minDays, maxDays, minCount, maxCount } -> circuit inputs */
function mapClause({ type, minDays = 0, maxDays = FOREVER, minCount = 0, maxCount = N }) {
  return { target_type: s(type), min_days: s(minDays), max_days: s(maxDays), min_count: s(minCount), max_count: s(maxCount) };
}

/** Chart (de)serialization for wallet files (bigint salt). */
export const saveChart = (c) => ({ ...c, salt: s(c.salt) });
export const loadChart = (c) => ({ ...c, salt: BigInt(c.salt) });
