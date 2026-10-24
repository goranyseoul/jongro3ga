// End-to-end on local anvil: deploy registry, append clinic-issued records with ZK append proofs,
// then a different clinic verifies a sales-offer condition against the ON-CHAIN commitment.
// Usage: anvil &  node e2e.mjs
import { readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { deployArtifact } from './deploy-utils.mjs';
import { createProver, emptyChart, PROCEDURES } from './records.mjs';

const { REJURAN, FILLER, THERMAGE } = PROCEDURES;
const DAY = 86400;
const art = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url)));
const rpc = http('http://127.0.0.1:8545');
// anvil default account #0 acts as the platform relayer
const account = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
const pub = createPublicClient({ chain: foundry, transport: rpc });
const wallet = createWalletClient({ account, chain: foundry, transport: rpc });
async function warpDays(d) {
  await pub.request({ method: 'evm_increaseTime', params: [d * DAY] });
  await pub.request({ method: 'evm_mine', params: [] });
}

const prover = await createProver();
const verifierAddr = await deployArtifact(wallet, pub, art('./build/HonkVerifier.json'));
const Registry = art('./build/RecordRegistry.json');
const registry = { address: await deployArtifact(wallet, pub, Registry, [verifierAddr, account.address, BigInt(DAY)]), abi: Registry.abi };
console.log('deployed registry', registry.address);

const subjectId = keccak256(toBytes('yuki-device-secret'));
let chart = emptyChart();
const onchainCommitment = () => pub.readContract({ ...registry, functionName: 'commitmentOf', args: [subjectId] });
const chainToday = async () => Number(await pub.readContract({ ...registry, functionName: 'today' }));

async function clinicVisit(type, { day, baseChart = chart } = {}) {
  day ??= await chainToday();
  const a = await prover.proveAppend(baseChart, await onchainCommitment(), type, day);
  const hash = await wallet.writeContract({ ...registry, functionName: 'append', args: [subjectId, a.newCommitment, a.recordHash, day, a.proofHex] });
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  if (rcpt.status !== 'success') throw new Error('reverted');
  chart = a.next;
  return rcpt.gasUsed;
}
async function checkOffer(label, clauses, expectPass) {
  const commitment = await onchainCommitment();
  const today = await chainToday();
  let ok = false, why = '';
  try { ok = await prover.verifyOffer(await prover.proveOffer(chart, commitment, today, clauses), commitment, today, clauses); }
  catch (e) { why = e.message.split('\n')[0]; }
  console.log(`  ${ok === expectPass ? 'PASS' : 'FAIL'}  ${label} -> ${ok ? 'eligible' : `not eligible ${why}`}`);
}
async function expectRevert(label, fn) {
  try { await fn(); console.log(`  FAIL  ${label}: should have been rejected`); }
  catch (e) { console.log(`  PASS  ${label}: rejected (${(e.shortMessage || e.message).split('\n')[0]})`); }
}

const rejuranOffer = [{ type: REJURAN, minCount: 2 }, { type: REJURAN, maxDays: 59, maxCount: 0 }];

console.log('\n[timeline]');
console.log('  day 0   Rejuran @ clinic A  gas', await clinicVisit(REJURAN));
await warpDays(50);
console.log('  day 50  Rejuran @ clinic A  gas', await clinicVisit(REJURAN));
await warpDays(20);
await checkOffer('day 70  Clinic B "Rejuran>=2, last 60+ days ago"', rejuranOffer, false);
await warpDays(45);
await checkOffer('day 115 Clinic B "Rejuran>=2, last 60+ days ago"', rejuranOffer, true);
await checkOffer('day 115 Clinic C "had Thermage"', [{ type: THERMAGE, minCount: 1 }], false);

console.log('\n[attacks]');
const t = await chainToday();
await expectRevert('backdated record (60 days ago)', () => clinicVisit(FILLER, { day: t - 60 }));
const staleChart = { ...chart, types: [...chart.types], dates: [...chart.dates] };
console.log('  day 115 Filler @ clinic C  gas', await clinicVisit(FILLER));
await expectRevert('rollback: append onto the pre-filler chart', () => clinicVisit(THERMAGE, { baseChart: staleChart }));
const realChart = chart;
chart = staleChart;
await checkOffer('stale chart "no filler within 14 days"', [{ type: FILLER, maxDays: 14, maxCount: 0 }], false);
chart = realChart;
// proof for clinic B's clause replayed against clinic C's (different) clause
{
  const commitment = await onchainCommitment();
  const proofs = await prover.proveOffer(chart, commitment, t, [{ type: REJURAN, minCount: 1 }]);
  const ok = await prover.verifyOffer(proofs, commitment, t, [{ type: THERMAGE, minCount: 1 }]);
  console.log(`  ${ok ? 'FAIL' : 'PASS'}  replay a Rejuran proof as a Thermage proof -> ${ok ? 'accepted' : 'rejected'}`);
}
console.log('\non-chain version', await pub.readContract({ ...registry, functionName: 'versionOf', args: [subjectId] }));
await prover.destroy();
