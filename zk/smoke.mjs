// Smoke test for the eligibility circuit (v2: records carry a clinic). Runs without a chain:
// proves offer clauses against a commitment computed locally and verifies them with the vk.
// Exit code 1 when any expectation fails. Usage: cd zk && npm run smoke
import { readFileSync } from 'node:fs';
import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend, UltraHonkVerifierBackend } from '@aztec/bb.js';

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const eligibility = load('./eligibility/target/eligibility.json');
const commitCircuit = load('./commit/target/commit.json');
const codes = load('./codes.json');

const P = (id) => String(codes.procedures[id]);
const C = (id) => String(codes.clinics[id]);
const FOREVER = '100000', N = '8', TODAY = '170';
const clause = ({ type = '0', clinic = '0', minDays = '0', maxDays = FOREVER, minCount = '0', maxCount = N }) =>
  ({ target_type: type, target_clinic: clinic, min_days: minDays, max_days: maxDays, min_count: minCount, max_count: maxCount });

// Lin: one Rejuran at Hanbit 40 days ago. Jisoo-like chart: two Rejuran at Seoul Glow 130 and 100 days ago plus a Botox at Dahye.
const empty = () => ({ types: Array(8).fill('0'), dates: Array(8).fill('0'), clinics: Array(8).fill('0') });
const lin = { ...empty(), salt: '123456789' };
lin.types[0] = P('rejuran_healer'); lin.dates[0] = '130'; lin.clinics[0] = C('cln_hanbit');
const regular = { ...empty(), salt: '987' };
regular.types[0] = P('rejuran_healer'); regular.dates[0] = '40'; regular.clinics[0] = C('cln_seoul_glow');
regular.types[1] = P('rejuran_healer'); regular.dates[1] = '70'; regular.clinics[1] = C('cln_seoul_glow');
regular.types[2] = P('botox_forehead'); regular.dates[2] = '100'; regular.clinics[2] = C('cln_dahye');

const api = await Barretenberg.new();
const backend = new UltraHonkBackend(eligibility.bytecode, api);
const vk = await backend.getVerificationKey(); // clinic side: verification key only, never the chart
const verifier = new UltraHonkVerifierBackend(api);
const noir = new Noir(eligibility);
const commitNoir = new Noir(commitCircuit);

let failures = 0;
async function offer(label, clauses, who, expectEligible) {
  const { returnValue: c } = await commitNoir.execute(who);
  let eligible = true, why = '';
  const t = Date.now();
  try {
    for (const cond of clauses) {
      const { witness } = await noir.execute({ ...who, commitment: c, today: TODAY, ...cond });
      const proof = await backend.generateProof(witness);
      const ok = await verifier.verifyProof({ ...proof, verificationKey: vk });
      if (!ok || proof.publicInputs[0] !== c) throw new Error('verify failed');
    }
  } catch (e) { eligible = false; why = e.message.split('\n')[0]; }
  const pass = eligible === expectEligible;
  if (!pass) failures++;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label} -> ${eligible ? `eligible (${clauses.length} proofs, ${Date.now() - t}ms)` : `not eligible (${why})`}`);
}

console.log('[spec demo offers]');
const secondSession = [clause({ type: P('rejuran_healer'), minCount: '1', maxCount: '1' })];
const hanbitContinue = [clause({ type: P('rejuran_healer'), clinic: C('cln_hanbit'), minCount: '1', maxCount: '1' })];
const mintFirstVisit = [clause({ clinic: C('cln_mint'), maxCount: '0' })];
const hanbitFirstVisit = [clause({ clinic: C('cln_hanbit'), maxCount: '0' })];
const loyal3 = [clause({ type: P('rejuran_healer'), minCount: '3' })];
const noBotox90 = [clause({ type: P('botox_forehead'), maxDays: '90', maxCount: '0' })];

await offer('Lin: Seoul Glow 2nd-session (Rejuran exactly once)', secondSession, lin, true);
await offer('Lin: Hanbit continue (Rejuran @ Hanbit exactly once)', hanbitContinue, lin, true);
await offer('Lin: Mint first visit', mintFirstVisit, lin, true);
await offer('Lin: Hanbit first visit (has a record there)', hanbitFirstVisit, lin, false);
await offer('Lin: loyal 3+ Rejuran', loyal3, lin, false);
await offer('Regular: 2nd-session (has two sessions)', secondSession, regular, false);
await offer('Regular: Mint first visit', mintFirstVisit, regular, true);
await offer('Regular: safety "no Botox within 90 days" (Botox 70 days ago)', noBotox90, regular, false);
await api.destroy();

console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
