// End-to-end on local anvil: deploy registry, append clinic-issued records with ZK append proofs,
// then a different clinic verifies a sales-offer condition against the ON-CHAIN commitment.
// Usage: anvil &  node e2e.mjs
import { readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, keccak256, toBytes, toHex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { Noir } from '@noir-lang/noir_js';
import { Barretenberg, UltraHonkBackend, UltraHonkVerifierBackend } from '@aztec/bb.js';
import { deployArtifact } from './deploy-utils.mjs';

const art = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const appendCircuit = art('../zk/append/target/append.json');
const eligCircuit = art('../zk/eligibility/target/eligibility.json');
const commitCircuit = art('../zk/commit/target/commit.json');
const recordHashCircuit = art('../zk/record_hash/target/record_hash.json');
const Verifier = art('./build/HonkVerifier.json');
const Registry = art('./build/RecordRegistry.json');

const N = 8, REJURAN = 1, FILLER = 2, THERMAGE = 4, FOREVER = 100000;
const DAY = 86400;
const rpc = http('http://127.0.0.1:8545');
// anvil default account #0 acts as the platform relayer
const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const pub = createPublicClient({ chain: foundry, transport: rpc });
const wallet = createWalletClient({ account, chain: foundry, transport: rpc });

const deploy = (c, args) => deployArtifact(wallet, pub, c, args);
async function warpDays(d) {
  await pub.request({ method: 'evm_increaseTime', params: [d * DAY] });
  await pub.request({ method: 'evm_mine', params: [] });
}

const api = await Barretenberg.new();
const appendNoir = new Noir(appendCircuit), eligNoir = new Noir(eligCircuit);
const commitNoir = new Noir(commitCircuit), recordHashNoir = new Noir(recordHashCircuit);
const appendBackend = new UltraHonkBackend(appendCircuit.bytecode, api);
const eligBackend = new UltraHonkBackend(eligCircuit.bytecode, api);
const eligVk = await eligBackend.getVerificationKey();
const verifier = new UltraHonkVerifierBackend(api);
const rand = () => BigInt(keccak256(crypto.getRandomValues(new Uint8Array(32)))) >> 8n; // < field modulus
const s = (x) => x.toString();

const verifierAddr = await deploy(Verifier);
const registryAddr = await deploy(Registry, [verifierAddr, account.address, BigInt(DAY)]);
const registry = { address: registryAddr, abi: Registry.abi };
console.log('deployed verifier', verifierAddr, 'registry', registryAddr);

// ---- Yuki's wallet (private, on her device) ----
const subjectId = keccak256(toBytes('yuki-device-secret'));
let chart = { types: Array(N).fill(0), dates: Array(N).fill(0), salt: rand() };
const chartInput = (c) => ({ types: c.types.map(s), dates: c.dates.map(s), salt: s(c.salt) });
const commitmentOf = async (c) => (await commitNoir.execute(chartInput(c))).returnValue;
const onchainCommitment = () => pub.readContract({ ...registry, functionName: 'commitmentOf', args: [subjectId] });
const chainToday = async () => Number(await pub.readContract({ ...registry, functionName: 'today' }));

// Clinic issues a record -> Yuki's wallet builds the append proof -> relayer submits on-chain.
async function clinicVisit(type, { day, baseChart = chart } = {}) {
  day ??= await chainToday();
  const slot = baseChart.types.findIndex((t) => t === 0);
  const next = { types: [...baseChart.types], dates: [...baseChart.dates], salt: rand() };
  next.types[slot] = type;
  next.dates[slot] = day;
  const recordNonce = rand(); // shared with the issuing clinic only
  const recordHash = (await recordHashNoir.execute({ new_type: s(type), new_date: s(day), record_nonce: s(recordNonce) })).returnValue;
  const newCommitment = await commitmentOf(next);
  const { witness } = await appendNoir.execute({
    old_types: baseChart.types.map(s), old_dates: baseChart.dates.map(s), old_salt: s(baseChart.salt),
    new_salt: s(next.salt), slot: s(slot), new_type: s(type), record_nonce: s(recordNonce),
    old_commitment: await onchainCommitment(), new_commitment: newCommitment, record_hash: recordHash, new_date: s(day),
  });
  const proof = await appendBackend.generateProof(witness, { verifierTarget: 'evm' });
  // relayer submits: only subjectId, commitments, opaque recordHash and the day go on-chain
  const hash = await wallet.writeContract({ ...registry, functionName: 'append', args: [subjectId, newCommitment, recordHash, day, toHex(proof.proof)] });
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  if (rcpt.status !== 'success') throw new Error('reverted');
  chart = next;
  return rcpt.gasUsed;
}

// A clinic checks a sales-offer condition against the commitment it reads from the chain.
async function checkOffer(label, clauses) {
  const commitment = await onchainCommitment();
  const today = await chainToday();
  try {
    for (const cond of clauses) {
      const { witness } = await eligNoir.execute({ ...chartInput(chart), commitment, today: s(today), ...cond });
      const proof = await eligBackend.generateProof(witness);
      if (proof.publicInputs[0] !== commitment) throw new Error('commitment mismatch');
      if (!(await verifier.verifyProof({ ...proof, verificationKey: eligVk }))) throw new Error('invalid');
    }
    console.log(`  ✔ ${label}`);
  } catch (e) {
    console.log(`  ✘ ${label}  (${e.message.split('\n')[0]})`);
  }
}
async function expectRevert(label, fn) {
  try { await fn(); console.log(`  ✘ ${label}: should have reverted`); }
  catch (e) { console.log(`  ✔ ${label}: rejected (${(e.shortMessage || e.message).split('\n')[0]})`); }
}

const rejuranOffer = [
  { target_type: s(REJURAN), min_days: '0', max_days: s(FOREVER), min_count: '2', max_count: s(N) },
  { target_type: s(REJURAN), min_days: '0', max_days: '59', min_count: '0', max_count: '0' },
];

console.log('\n[timeline]');
console.log('  day 0   Rejuran @ clinic A  gas', await clinicVisit(REJURAN));
await warpDays(50);
console.log('  day 50  Rejuran @ clinic A  gas', await clinicVisit(REJURAN));
await warpDays(20);
await checkOffer('day 70: Clinic B offer "Rejuran>=2, last 60+ days ago" (expect FAIL, last was 20d ago)', rejuranOffer);
await warpDays(45);
await checkOffer('day 115: Clinic B offer "Rejuran>=2, last 60+ days ago" (expect PASS)', rejuranOffer);
await checkOffer('day 115: Clinic C offer "had Thermage" (expect FAIL)', [
  { target_type: s(THERMAGE), min_days: '0', max_days: s(FOREVER), min_count: '1', max_count: s(N) },
]);

console.log('\n[attacks]');
const t = await chainToday();
await expectRevert('backdated record (60 days ago)', () => clinicVisit(FILLER, { day: t - 60 }));
const staleChart = { ...chart, types: [...chart.types], dates: [...chart.dates] };
console.log('  day 115 Filler @ clinic C  gas', await clinicVisit(FILLER));
await expectRevert('rollback: append onto the OLD chart (hide the filler)', () => clinicVisit(THERMAGE, { baseChart: staleChart }));
const realChart = chart;
chart = staleChart; // Yuki tries to prove "no filler in 14 days" with her pre-filler chart
await checkOffer('stale chart: "no filler within 14 days" (expect FAIL: commitment is not on-chain)', [
  { target_type: s(FILLER), min_days: '0', max_days: '14', min_count: '0', max_count: '0' },
]);
chart = realChart;
console.log('\non-chain version', await pub.readContract({ ...registry, functionName: 'versionOf', args: [subjectId] }));
await api.destroy();
