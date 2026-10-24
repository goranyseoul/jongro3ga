// End-to-end on local anvil: deploy registry, append clinic-issued records with ZK append proofs,
// then a different clinic verifies a sales-offer condition against the ON-CHAIN commitment.
// Usage: anvil &  node e2e.mjs
import { readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { foundry } from 'viem/chains';
import { deployArtifact } from './deploy-utils.mjs';
import { createProver, emptyChart } from './records.mjs';

// circuit codes from zk/codes.json (spec ids); FILLER is a test-only code outside the catalog
const codes = JSON.parse(readFileSync(new URL('../zk/codes.json', import.meta.url)));
const REJURAN = codes.procedures.rejuran_healer, BOTOX = codes.procedures.botox_forehead, FILLER = 99;
const HANBIT = codes.clinics.cln_hanbit, MINT = codes.clinics.cln_mint, DAHYE = codes.clinics.cln_dahye;
let failures = 0;
const report = (pass, text) => { if (!pass) failures++; console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${text}`); };
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

const subjectId = keccak256(toBytes('lin-device-secret'));
let chart = emptyChart();
const onchainCommitment = () => pub.readContract({ ...registry, functionName: 'commitmentOf', args: [subjectId] });
const chainToday = async () => Number(await pub.readContract({ ...registry, functionName: 'today' }));

async function clinicVisit(type, clinic, { day, baseChart = chart } = {}) {
  day ??= await chainToday();
  const a = await prover.proveAppend(baseChart, await onchainCommitment(), type, clinic, day);
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
  report(ok === expectPass, `${label} -> ${ok ? 'eligible' : `not eligible ${why}`}`);
}
async function expectRevert(label, fn) {
  try { await fn(); report(false, `${label}: should have been rejected`); }
  catch (e) { report(true, `${label}: rejected (${(e.shortMessage || e.message).split('\n')[0]})`); }
}

// Lin (docs/spec): Rejuran exactly once anywhere -> 2nd-session offer at Seoul Glow; none in the last 27 days keeps it a real "next session"
const secondSession = [{ type: REJURAN, minCount: 1, maxCount: 1 }, { type: REJURAN, maxDays: 27, maxCount: 0 }];
// Mint first-visit event: no record of any kind there
const firstVisitMint = [{ clinic: MINT, maxCount: 0 }];

console.log('\n[timeline]');
console.log('  day 0   Rejuran @ Hanbit        gas', await clinicVisit(REJURAN, HANBIT));
await warpDays(10);
await checkOffer('day 10  2nd-session offer (too early)', secondSession, false);
await warpDays(20);
await checkOffer('day 30  2nd-session offer', secondSession, true);
await checkOffer('day 30  first visit at Mint', firstVisitMint, true);
console.log('  day 30  Rejuran @ Mint          gas', await clinicVisit(REJURAN, MINT));
await checkOffer('day 30  first visit at Mint again', firstVisitMint, false);

console.log('\n[attacks]');
const t = await chainToday();
await expectRevert('backdated record (60 days ago)', () => clinicVisit(FILLER, DAHYE, { day: t - 60 }));
const staleChart = { ...chart, types: [...chart.types], dates: [...chart.dates], clinics: [...chart.clinics] };
console.log('  day 30  Filler @ Dahye          gas', await clinicVisit(FILLER, DAHYE));
await expectRevert('rollback: append onto the pre-filler chart', () => clinicVisit(BOTOX, DAHYE, { baseChart: staleChart }));
const realChart = chart;
chart = staleChart;
await checkOffer('stale chart "no filler within 14 days"', [{ type: FILLER, maxDays: 14, maxCount: 0 }], false);
chart = realChart;
{
  const commitment = await onchainCommitment();
  const proofs = await prover.proveOffer(chart, commitment, t, [{ type: REJURAN, minCount: 1 }]);
  const ok = await prover.verifyOffer(proofs, commitment, t, [{ type: BOTOX, minCount: 1 }]);
  report(!ok, `replay a Rejuran proof as a Botox proof -> ${ok ? 'accepted' : 'rejected'}`);
}
console.log('\non-chain version', await pub.readContract({ ...registry, functionName: 'versionOf', args: [subjectId] }));
await prover.destroy();
console.log(failures ? `\n${failures} failure(s)` : '\nall passed');
process.exit(failures ? 1 : 0);
