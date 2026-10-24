// Appends one clinic-issued record for a demo persona on Base Sepolia (deployer = platform relayer).
// Usage: node --env-file=.env seed.mjs <persona> <PROCEDURE> [clinicId]   e.g. seed.mjs yuki REJURAN glow
//        node --env-file=.env seed.mjs <persona>               (status only)
// Persona wallets (private chart + salt) live in wallets/<persona>.json, which is gitignored.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, keccak256, formatEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { createProver, emptyChart, loadChart, saveChart, PROCEDURES } from './records.mjs';

const [persona, procName, clinicId] = process.argv.slice(2);
if (!persona) throw new Error('usage: seed.mjs <persona> [PROCEDURE]');
const dep = JSON.parse(readFileSync('deployments/base-sepolia.json'));
const Registry = JSON.parse(readFileSync('build/RecordRegistry.json'));
const registry = { address: dep.registry, abi: Registry.abi };
const account = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const transport = http(process.env.BASE_SEPOLIA_RPC);
const pub = createPublicClient({ chain: baseSepolia, transport });
const wallet = createWalletClient({ account, chain: baseSepolia, transport });

mkdirSync('wallets', { recursive: true });
const file = `wallets/${persona}.json`;
const w = existsSync(file)
  ? { ...JSON.parse(readFileSync(file)), chart: loadChart(JSON.parse(readFileSync(file)).chart) }
  : { persona, subjectId: keccak256(crypto.getRandomValues(new Uint8Array(32))), chart: emptyChart(), records: [] };
const save = () => writeFileSync(file, JSON.stringify({ ...w, chart: saveChart(w.chart) }, null, 2) + '\n');

const today = Number(await pub.readContract({ ...registry, functionName: 'today' }));
if (procName) {
  const type = PROCEDURES[procName];
  if (!type) throw new Error(`unknown procedure ${procName}; one of ${Object.keys(PROCEDURES)}`);
  const prover = await createProver();
  const old = await pub.readContract({ ...registry, functionName: 'commitmentOf', args: [w.subjectId] });
  const a = await prover.proveAppend(w.chart, old, type, today);
  await prover.destroy();
  const hash = await wallet.writeContract({ ...registry, functionName: 'append', args: [w.subjectId, a.newCommitment, a.recordHash, today, a.proofHex] });
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  if (rcpt.status !== 'success') throw new Error(`append reverted: ${hash}`);
  w.chart = a.next;
  w.records.push({ procedure: procName, day: today, clinicId, recordNonce: a.recordNonce.toString(), tx: hash });
  save();
  console.log(`appended ${procName} for ${persona} on day ${today}: https://sepolia.basescan.org/tx/${hash}`);
}
save();
console.log(`${persona} today=${today}`, w.records.map((r) => `${r.procedure}@${r.day} (${today - r.day}d ago)`).join(', ') || '(no records)');
console.log('relayer balance', formatEther(await pub.getBalance({ address: account.address })), 'ETH');
