// Patient wallet + clinic verifier + platform relayer, wired to the Base Sepolia registry.
// In the product the wallet runs on the patient's phone; for the demo it runs in this server,
// and the UI makes the boundary explicit (what stays on-device vs. what a clinic receives).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, keccak256, toHex, hexToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { createProver, emptyChart, loadChart, saveChart, PROCEDURES, FOREVER, N } from '../chain/records.mjs';
import { newVisitIdentity, importVisitIdentity, writeReview } from '../chain/reviews.mjs';
import { clinicById, offerById, PROCEDURE_NAMES } from './clinics.mjs';

const CHAIN_DIR = new URL('../chain/', import.meta.url);
const dep = JSON.parse(readFileSync(new URL('deployments/base-sepolia.json', CHAIN_DIR)));
const Registry = JSON.parse(readFileSync(new URL('build/RecordRegistry.json', CHAIN_DIR)));
const registry = { address: dep.registry, abi: Registry.abi };
const transport = http(process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org');
const pub = createPublicClient({ chain: baseSepolia, transport });
export const deployment = dep;

export const PERSONAS = {
  yuki: { id: 'yuki', name: 'Yuki', flag: '🇯🇵', country: 'Japan', age: 27, language: 'Japanese (reads English)', stay: 'Nov 2 – Nov 6 (5 days)', budgetKRW: 600000, goals: 'Glowy, plump skin. Pores and fine texture. No visible downtime — has a wedding on Nov 9.' },
  lin: { id: 'lin', name: 'Lin', flag: '🇨🇳', country: 'China', age: 31, language: 'Chinese (reads English)', stay: 'Nov 3 – Nov 5 (3 days)', budgetKRW: 2000000, goals: 'Jawline and lower-face lifting. Has done Thermage before and wants something stronger.' },
  emily: { id: 'emily', name: 'Emily', flag: '🇺🇸', country: 'USA', age: 29, language: 'English', stay: 'Nov 1 – Nov 8 (8 days)', budgetKRW: 800000, goals: 'First time in Korea. Wants brighter, even skin tone; open to recommendations.' },
};

const codeName = Object.fromEntries(Object.entries(PROCEDURES).map(([k, v]) => [v, k]));
let proverPromise;
const prover = () => (proverPromise ??= createProver());

// ---------- chain reads ----------
export const chainToday = async () => Number(await pub.readContract({ ...registry, functionName: 'today' }));
export const commitmentOf = (subjectId) => pub.readContract({ ...registry, functionName: 'commitmentOf', args: [subjectId] });
export const versionOf = (subjectId) => pub.readContract({ ...registry, functionName: 'versionOf', args: [subjectId] });

// ---------- patient wallet (on-device in the product) ----------
const walletFile = (p) => new URL(`wallets/${p}.json`, CHAIN_DIR);
export function loadWallet(persona) {
  if (!PERSONAS[persona]) throw new Error(`unknown persona ${persona}`);
  if (!existsSync(walletFile(persona))) {
    return { persona, subjectId: keccak256(toHex(`${persona}:${crypto.randomUUID()}`)), chart: emptyChart(), records: [], tickets: [] };
  }
  const w = JSON.parse(readFileSync(walletFile(persona)));
  return { tickets: [], ...w, chart: loadChart(w.chart) };
}
function saveWallet(w) {
  mkdirSync(new URL('wallets/', CHAIN_DIR), { recursive: true });
  writeFileSync(walletFile(w.persona), JSON.stringify({ ...w, chart: saveChart(w.chart) }, null, 2) + '\n');
}

/** Private view for the patient's own agent: full history, never sent anywhere. */
export async function walletView(persona) {
  const w = loadWallet(persona);
  const today = await chainToday();
  const [onchain, version] = await Promise.all([commitmentOf(w.subjectId), versionOf(w.subjectId)]);
  return {
    profile: PERSONAS[persona],
    today,
    records: w.records.map((r) => ({ procedure: r.procedure, name: PROCEDURE_NAMES[PROCEDURES[r.procedure]], clinic: r.clinicId ? clinicById(r.clinicId)?.name : 'Another clinic (non-partner)', daysAgo: today - r.day, tx: r.tx })),
    onchain: { subjectId: w.subjectId, commitment: onchain, version: Number(version), inSync: BigInt(onchain) !== 0n || w.records.length === 0 },
    pendingReviews: (w.tickets ?? []).filter((t) => !t.reviewed).map(({ clinicId, procedure }) => ({ clinicId, procedure })),
  };
}

/** Same predicate the circuit enforces, evaluated locally (nothing leaves the device). */
function clauseHolds(chart, today, { type, minDays = 0, maxDays = FOREVER, minCount = 0, maxCount = N }) {
  let count = 0;
  for (let i = 0; i < N; i++) {
    const d = chart.dates[i];
    if (chart.types[i] === type && d + minDays <= today && today <= d + maxDays) count++;
  }
  return minCount <= count && count <= maxCount;
}
export async function matchOffersLocally(persona, offers) {
  const w = loadWallet(persona);
  const today = await chainToday();
  return offers.map((o) => ({ offerId: o.id, eligible: o.clauses.every((c) => clauseHolds(w.chart, today, c)) }));
}

/** Wallet: prove an offer's clauses against the on-chain commitment. */
export async function proveOffer(persona, offerId) {
  const offer = offerById(offerId);
  if (!offer) throw new Error(`unknown offer ${offerId}`);
  const w = loadWallet(persona);
  const [commitment, today] = [await commitmentOf(w.subjectId), await chainToday()];
  const p = await prover();
  const proofs = await p.proveOffer(w.chart, commitment, today, offer.clauses);
  return {
    subjectId: w.subjectId,
    offerId,
    today,
    proofs: proofs.map((x) => ({ proof: toHex(x.proof), publicInputs: x.publicInputs })),
  };
}

// ---------- clinic side ----------
/** Clinic: verify an attached proof bundle. Sees only subjectId, public inputs and the proof bytes. */
export async function verifyOfferBundle(clinicId, bundle) {
  const offer = offerById(bundle.offerId);
  if (!offer || offer.clinicId !== clinicId) return { ok: false, reason: 'offer does not belong to this clinic' };
  const chainNow = await chainToday();
  // demo clock ticks every minute: accept a proof made for today or yesterday
  if (bundle.today !== chainNow && bundle.today !== chainNow - 1) return { ok: false, reason: 'stale proof date' };
  const commitment = await commitmentOf(bundle.subjectId);
  if (BigInt(commitment) === 0n) return { ok: false, reason: 'subject has no on-chain record' };
  const p = await prover();
  const proofs = bundle.proofs.map((x) => ({ proof: hexToBytes(x.proof), publicInputs: x.publicInputs }));
  const ok = await p.verifyOffer(proofs, commitment, bundle.today, offer.clauses);
  return { ok, reason: ok ? 'all clauses proven against the on-chain commitment' : 'proof did not verify', commitment, today: bundle.today };
}

// ---------- platform relayer: record a completed visit ----------
export async function recordVisit(persona, clinicId, procName, reviewBoard) {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY missing (app/.env.local)');
  const type = PROCEDURES[procName];
  if (!type) throw new Error(`unknown procedure ${procName}`);
  const w = loadWallet(persona);
  const wallet = createWalletClient({ account: privateKeyToAccount(pk), chain: baseSepolia, transport });
  const p = await prover();
  const today = await chainToday();
  const a = await p.proveAppend(w.chart, await commitmentOf(w.subjectId), type, today);
  const hash = await wallet.writeContract({ ...registry, functionName: 'append', args: [w.subjectId, a.newCommitment, a.recordHash, today, a.proofHex] });
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  if (rcpt.status !== 'success') throw new Error(`append reverted: ${hash}`);
  w.chart = a.next;
  w.records.push({ procedure: procName, day: today, clinicId, recordNonce: a.recordNonce.toString(), tx: hash });
  // review ticket: a fresh identity per visit, unlinkable to subjectId
  const id = newVisitIdentity();
  reviewBoard.issueTicket(clinicId, procName, id.commitment);
  w.tickets = [...(w.tickets ?? []), { clinicId, procedure: procName, identity: id.export(), reviewed: false }];
  saveWallet(w);
  return { tx: hash, day: today };
}

export async function submitPatientReview(persona, clinicId, procedure, review, reviewBoard) {
  const w = loadWallet(persona);
  const t = (w.tickets ?? []).find((x) => x.clinicId === clinicId && x.procedure === procedure && !x.reviewed);
  if (!t) throw new Error('no unused review ticket for this clinic/procedure');
  const r = await writeReview(importVisitIdentity(t.identity), reviewBoard.groupOf(clinicId, procedure), clinicId, procedure, review);
  const res = await reviewBoard.submitReview(r);
  if (res.ok) { t.reviewed = true; saveWallet(w); }
  return res;
}

export const procedureCodeName = (type) => codeName[type];
