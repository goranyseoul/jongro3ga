import { readFileSync } from 'node:fs';
import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend, UltraHonkVerifierBackend } from '@aztec/bb.js';

const load = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const eligibility = load('./eligibility/target/eligibility.json');
const commitCircuit = load('./commit/target/commit.json');

const REJURAN = '1', FILLER = '2', THERMAGE = '4';
const FOREVER = '100000', N = '8';

// Yuki's private chart (days since epoch-ish). today = 170
const chart = {
  types: [REJURAN, REJURAN, FILLER, '0', '0', '0', '0', '0'],
  dates: ['50', '100', '160', '0', '0', '0', '0', '0'],
  salt: '123456789',
};
const { returnValue: commitment } = await new Noir(commitCircuit).execute(chart);
console.log('registry commitment', commitment);

const api = await Barretenberg.new();
const backend = new UltraHonkBackend(eligibility.bytecode, api);
// Clinic side: verification key only, never sees the chart
const vk = await backend.getVerificationKey();
const verifier = new UltraHonkVerifierBackend(api);
const noir = new Noir(eligibility);

// An offer is a list of clauses; every clause is proven against the SAME registry commitment.
async function offer(label, clauses, who = chart) {
  const { returnValue: c } = await new Noir(commitCircuit).execute(who);
  try {
    const t = Date.now();
    for (const cond of clauses) {
      const { witness } = await noir.execute({ ...who, commitment: c, today: '170', ...cond });
      const proof = await backend.generateProof(witness);
      const ok = await verifier.verifyProof({ ...proof, verificationKey: vk });
      if (!ok || proof.publicInputs[0] !== c) throw new Error('verify failed');
    }
    console.log(`✔ ${label}: verified (${clauses.length} proofs, ${Date.now() - t}ms)`);
  } catch (e) {
    console.log(`✘ ${label}: not eligible (${e.message.split('\n')[0]})`);
  }
}

// "Rejuran >= 2 times AND the most recent one 60+ days ago"
const rejuranOffer = [
  { target_type: REJURAN, min_days: '0', max_days: FOREVER, min_count: '2', max_count: N }, // total >= 2
  { target_type: REJURAN, min_days: '0', max_days: '59', min_count: '0', max_count: '0' },  // none in last 59 days
];
await offer('S1 Clinic B (Yuki: Rejuran 120d, 70d ago)', rejuranOffer);
// Mika had a 3rd Rejuran 20 days ago -> "last one 60+ days ago" must FAIL
const mika = { types: [REJURAN, REJURAN, REJURAN, '0', '0', '0', '0', '0'], dates: ['20', '70', '150', '0', '0', '0', '0', '0'], salt: '987' };
await offer('S1 Clinic B (Mika: 3rd Rejuran 20d ago)', rejuranOffer, mika);
await offer('S2 Clinic C: had Thermage before', [{ target_type: THERMAGE, min_days: '0', max_days: FOREVER, min_count: '1', max_count: N }]);
await offer('Safety: no filler within 14 days', [{ target_type: FILLER, min_days: '0', max_days: '14', min_count: '0', max_count: '0' }]);
await api.destroy();
