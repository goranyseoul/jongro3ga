// Patient wallet + clinic verifier + platform relayer, wired to the Base Sepolia registry.
// In the product the wallet runs on the patient's phone; for the demo it runs in this server,
// and the UI makes the boundary explicit (what stays on-device vs. what a clinic receives).
import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, keccak256, toHex, hexToBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { createProver, emptyChart, loadChart, saveChart, clauseHolds } from '../chain/records.mjs';
import { newVisitIdentity, importVisitIdentity, writeReview } from '../chain/reviews.mjs';
import { PERSONAS, PROCEDURES, CLINICS, OFFERS, SELF_REPORTED, BASELINE_RECORDS, offerById, describeClause, resolvePersona } from './catalog.mjs';

const CHAIN_DIR = new URL('../chain/', import.meta.url);
const dep = JSON.parse(readFileSync(new URL('deployments/base-sepolia.json', CHAIN_DIR)));
const Registry = JSON.parse(readFileSync(new URL('build/RecordRegistry.json', CHAIN_DIR)));
const registry = { address: dep.registry, abi: Registry.abi };
const transport = http(process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org');
const pub = createPublicClient({ chain: baseSepolia, transport });
export const deployment = dep;

let proverPromise;
const prover = () => (proverPromise ??= createProver());

// ---------- chain reads ----------
export const chainToday = async () => Number(await pub.readContract({ ...registry, functionName: 'today' }));
export const commitmentOf = (subjectId) => pub.readContract({ ...registry, functionName: 'commitmentOf', args: [subjectId] });
export const versionOf = (subjectId) => pub.readContract({ ...registry, functionName: 'versionOf', args: [subjectId] });

/** Public ledger: every RecordAppended event, exactly what anyone can read from the chain.
 *  The public RPC caps eth_getLogs at 200 blocks, so scan incrementally in chunks and cache. */
const ledgerCache = { events: [], next: BigInt(dep.deployBlock ?? 0), scanning: null };
const LOG_RANGE = 199n;
async function scanLedger() {
  const latest = await pub.getBlockNumber();
  const ranges = [];
  for (let from = ledgerCache.next; from <= latest; from += LOG_RANGE + 1n) ranges.push([from, from + LOG_RANGE > latest ? latest : from + LOG_RANGE]);
  for (let i = 0; i < ranges.length; i += 8) {
    const batch = await Promise.all(ranges.slice(i, i + 8).map(([fromBlock, toBlock]) =>
      pub.getContractEvents({ ...registry, eventName: 'RecordAppended', fromBlock, toBlock })));
    for (const l of batch.flat()) {
      const block = await pub.getBlock({ blockNumber: l.blockNumber });
      ledgerCache.events.push({
        tx: l.transactionHash,
        block: Number(l.blockNumber),
        timestamp: Number(block.timestamp) * 1000,
        subjectId: l.args.subjectId,
        commitment: l.args.commitment,
        version: Number(l.args.version),
        day: Number(l.args.day),
      });
    }
  }
  ledgerCache.next = latest + 1n;
}
export async function publicLedger() {
  ledgerCache.scanning ??= scanLedger().finally(() => { ledgerCache.scanning = null; });
  await ledgerCache.scanning;
  return [...ledgerCache.events].sort((a, b) => b.block - a.block);
}

// ---------- patient wallet (on-device in the product) ----------
const walletFile = (p) => new URL(`wallets/${p}.json`, CHAIN_DIR);
function loadWallet(id) {
  const persona = resolvePersona(id);
  if (!PERSONAS[persona]) throw new Error(`unknown persona ${id}`);
  const base = { persona, subjectId: keccak256(toHex(`${persona}:${crypto.randomUUID()}`)), chart: emptyChart(), records: [], tickets: [], selfReported: SELF_REPORTED[persona] ?? [] };
  if (!existsSync(walletFile(persona))) return base;
  const w = JSON.parse(readFileSync(walletFile(persona)));
  return { ...base, ...w, chart: loadChart(w.chart) };
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
    verifiedRecords: w.records.map((r) => ({
      procedureId: r.procedureId, procedure: PROCEDURES[r.procedureId].ko,
      clinicId: r.clinicId, clinic: CLINICS[r.clinicId].ko,
      daysAgo: today - r.day, tx: r.tx, source: 'clinic_confirmed',
    })),
    selfReported: w.selfReported.map((r) => ({ ...r, procedure: PROCEDURES[r.procedureId]?.ko ?? r.procedureId, source: 'self_reported' })),
    onchain: { subjectId: w.subjectId, commitment: onchain, version: Number(version) },
    pendingReviews: w.tickets.filter((t) => !t.reviewed).map(({ clinicId, procedureId }) => ({ clinicId, procedureId, clinic: CLINICS[clinicId].ko, procedure: PROCEDURES[procedureId].ko })),
  };
}

/** Self-reported import (e.g. memo text parsed by the customer agent). Stored on-device only. */
export function importSelfReported(persona, records) {
  const w = loadWallet(persona);
  w.selfReported = [...w.selfReported, ...records.map((r) => ({ ...r, source: 'self_reported' }))];
  saveWallet(w);
  return { count: w.selfReported.length };
}

/** On-device matching of every public offer rule; clinics never learn which offers did not match. */
export async function matchOffers(persona) {
  const w = loadWallet(persona);
  const today = await chainToday();
  return OFFERS.map((o) => ({
    offerId: o.id, clinicId: o.clinicId, clinic: CLINICS[o.clinicId].ko, title: o.title, benefit: o.benefit, scene: o.scene,
    conditions: o.clauses.map(describeClause),
    eligible: o.clauses.every((c) => clauseHolds(w.chart, today, c)),
  }));
}

/** Wallet: prove an offer's clauses against the on-chain commitment. */
export async function proveOffer(persona, offerId) {
  const offer = offerById(offerId);
  if (!offer) throw new Error(`unknown offer ${offerId}`);
  const w = loadWallet(persona);
  const commitment = await commitmentOf(w.subjectId);
  const today = await chainToday();
  const p = await prover();
  const t = Date.now();
  const proofs = await p.proveOffer(w.chart, commitment, today, offer.clauses);
  return {
    subjectId: w.subjectId,
    offerId,
    today,
    provingMs: Date.now() - t,
    proofs: proofs.map((x) => ({ proof: toHex(x.proof), publicInputs: x.publicInputs })),
  };
}

// ---------- clinic side ----------
/** Clinic: verify a proof bundle. Sees only subjectId, public inputs and proof bytes. */
export async function verifyOfferBundle(clinicId, bundle) {
  const offer = offerById(bundle.offerId);
  if (!offer || offer.clinicId !== clinicId) return { ok: false, reason: '이 병원의 오퍼가 아님' };
  const chainNow = await chainToday();
  // demo clock ticks every minute: accept a proof made for today or yesterday
  if (bundle.today !== chainNow && bundle.today !== chainNow - 1) return { ok: false, reason: '증명 날짜가 오래됨' };
  const commitment = await commitmentOf(bundle.subjectId);
  if (BigInt(commitment) === 0n) return { ok: false, reason: '온체인 기록이 없는 가명' };
  const p = await prover();
  const proofs = bundle.proofs.map((x) => ({ proof: hexToBytes(x.proof), publicInputs: x.publicInputs }));
  const ok = await p.verifyOffer(proofs, commitment, bundle.today, offer.clauses);
  return { ok, reason: ok ? '모든 조건이 온체인 해시 기준으로 증명됨' : '증명 검증 실패', commitment, today: bundle.today, conditions: offer.clauses.map(describeClause) };
}

// ---------- platform relayer: record a clinic-confirmed visit ----------
export async function recordVisit(persona, clinicId, procedureId, reviewBoard) {
  const pk = process.env.DEPLOYER_PRIVATE_KEY;
  if (!pk) throw new Error('DEPLOYER_PRIVATE_KEY missing (chain/.env)');
  if (!PROCEDURES[procedureId]) throw new Error(`unknown procedure ${procedureId}`);
  if (!CLINICS[clinicId]) throw new Error(`unknown clinic ${clinicId}`);
  const w = loadWallet(persona);
  const wallet = createWalletClient({ account: privateKeyToAccount(pk), chain: baseSepolia, transport });
  const p = await prover();
  const today = await chainToday();
  const a = await p.proveAppend(w.chart, await commitmentOf(w.subjectId), PROCEDURES[procedureId].code, CLINICS[clinicId].code, today);
  const hash = await wallet.writeContract({ ...registry, functionName: 'append', args: [w.subjectId, a.newCommitment, a.recordHash, today, a.proofHex] });
  const rcpt = await pub.waitForTransactionReceipt({ hash });
  if (rcpt.status !== 'success') throw new Error(`append reverted: ${hash}`);
  w.chart = a.next;
  w.records.push({ procedureId, clinicId, day: today, recordNonce: a.recordNonce.toString(), tx: hash });
  // review ticket: a fresh identity per visit, unlinkable to subjectId
  const id = newVisitIdentity();
  reviewBoard.issueTicket(clinicId, procedureId, id.commitment);
  w.tickets.push({ clinicId, procedureId, identity: id.export(), reviewed: false });
  saveWallet(w);
  return { tx: hash, day: today };
}

export async function submitPatientReview(persona, clinicId, procedureId, review, reviewBoard) {
  const w = loadWallet(persona);
  const t = w.tickets.find((x) => x.clinicId === clinicId && x.procedureId === procedureId && !x.reviewed);
  if (!t) throw new Error('이 병원·시술의 미사용 리뷰 티켓이 없음');
  const r = await writeReview(importVisitIdentity(t.identity), reviewBoard.groupOf(clinicId, procedureId), clinicId, procedureId, review);
  const res = await reviewBoard.submitReview(r);
  if (res.ok) { t.reviewed = true; saveWallet(w); }
  return res;
}

/** Demo reset: archive the wallet, start over under a fresh pseudonym, re-anchor the baseline records.
 *  The old pseudonym's history stays on-chain forever (by design) — it is simply no longer this wallet. */
export async function resetPersona(id, reviewBoard) {
  const persona = resolvePersona(id);
  if (!PERSONAS[persona]) throw new Error(`unknown persona ${id}`);
  if (existsSync(walletFile(persona))) {
    mkdirSync(new URL('wallets/archive/', CHAIN_DIR), { recursive: true });
    renameSync(walletFile(persona), new URL(`wallets/archive/${persona}-${Date.now()}.json`, CHAIN_DIR));
  }
  const txs = [];
  for (const [clinicId, procedureId] of BASELINE_RECORDS[persona] ?? []) txs.push(await recordVisit(persona, clinicId, procedureId, reviewBoard));
  if (!txs.length) saveWallet(loadWallet(persona));
  return { subjectId: loadWallet(persona).subjectId, baseline: txs };
}
