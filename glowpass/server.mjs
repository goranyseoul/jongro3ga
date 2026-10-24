// Demo server: static UI, A2A endpoints for clinic agents, concierge chat, SSE event stream.
// Usage: npm start   (reads glowpass/.env.local for ANTHROPIC_API_KEY, chain/.env for the relayer key)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { CLINICS, clinicById, agentCard } from './clinics.mjs';
import { publicLedger, walletView, recordVisit, submitPatientReview, deployment, PERSONAS, matchOffersLocally, proveOffer, verifyOfferBundle } from './wallet.mjs';
import { seedReviewBoard } from './reviews-seed.mjs';

const chainEnv = new URL('../chain/.env', import.meta.url);
if (existsSync(chainEnv)) process.loadEnvFile(chainEnv);
const { runConcierge, handleClinicMessage, resetConversations } = await import('./agents.mjs');

const PORT = Number(process.env.PORT ?? 3000);
const baseUrl = `http://localhost:${PORT}`;
const board = await seedReviewBoard();
console.log('review board seeded');

// ---------- SSE ----------
const subscribers = new Set();
let activePersona = null;
const emit = (e) => {
  const data = `data: ${JSON.stringify({ at: Date.now(), persona: activePersona, ...e })}\n\n`;
  for (const res of subscribers) res.write(data);
};

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const readBody = async (req) => { let b = ''; for await (const c of req) b += c; return b ? JSON.parse(b) : {}; };
const STATIC = { '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], '/ledger': ['ledger.html', 'text/html'], '/ledger.js': ['ledger.js', 'text/javascript'] };

function ranking() {
  const stats = board.stats();
  return CLINICS.map((c) => {
    const s = stats.find((x) => x.clinicId === c.id) ?? { verifiedVisits: 0, procedures: {} };
    const reviews = Object.entries(s.procedures).flatMap(([proc, p]) => p.reviews.map((r) => ({ ...r, procedure: proc })));
    const pending = Object.values(s.procedures).reduce((a, p) => a + p.pendingReviews, 0);
    return { clinicId: c.id, name: c.name, nameKo: c.nameKo, area: c.area, verifiedVisits: s.verifiedVisits, avgRating: reviews.length ? +(reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : null, reviews, pendingReviews: pending, procedures: s.procedures };
  }).sort((a, b) => b.verifiedVisits - a.verifiedVisits);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, baseUrl);
  const path = url.pathname;
  try {
    if (req.method === 'GET' && STATIC[path]) {
      const [file, type] = STATIC[path];
      res.writeHead(200, { 'content-type': `${type}; charset=utf-8` });
      return res.end(await readFile(new URL(`public/${file}`, import.meta.url)));
    }
    // ----- A2A: clinic agents -----
    let m = path.match(/^\/clinics\/([\w-]+)\/\.well-known\/agent-card\.json$/);
    if (m && clinicById(m[1])) return json(res, 200, agentCard(clinicById(m[1]), baseUrl));
    m = path.match(/^\/clinics\/([\w-]+)\/a2a$/);
    if (m && req.method === 'POST' && clinicById(m[1])) {
      const rpc = await readBody(req);
      if (rpc.method !== 'message/send') return json(res, 200, { jsonrpc: '2.0', id: rpc.id, error: { code: -32601, message: 'method not found' } });
      const result = await handleClinicMessage(m[1], rpc.params.message, emit);
      return json(res, 200, { jsonrpc: '2.0', id: rpc.id, result });
    }
    // ----- app API -----
    if (path === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
      res.write(': connected\n\n');
      subscribers.add(res);
      return req.on('close', () => subscribers.delete(res));
    }
    if (path === '/api/state') {
      const persona = url.searchParams.get('persona') ?? 'yuki';
      return json(res, 200, { personas: Object.values(PERSONAS), wallet: await walletView(persona), clinics: CLINICS.map((c) => agentCard(c, baseUrl)), ranking: ranking(), deployment });
    }
    // ----- ZK layer HTTP API for external agents (see docs/INTEGRATION.md) -----
    m = path.match(/^\/api\/wallet\/(\w+)$/);
    if (m && req.method === 'GET') return json(res, 200, await walletView(m[1]));
    if (path === '/api/zk/match-offers' && req.method === 'POST') {
      const { persona } = await readBody(req);
      const offers = CLINICS.flatMap((c) => c.offers.map((o) => ({ ...o, clinicId: c.id })));
      const results = await matchOffersLocally(persona, offers);
      return json(res, 200, offers.map((o, i) => ({ clinicId: o.clinicId, offerId: o.id, title: o.title, eligible: results[i].eligible })));
    }
    if (path === '/api/zk/prove-offer' && req.method === 'POST') {
      const { persona, offerId } = await readBody(req);
      return json(res, 200, await proveOffer(persona, offerId));
    }
    if (path === '/api/zk/verify-offer' && req.method === 'POST') {
      const { clinicId, bundle } = await readBody(req);
      const r = await verifyOfferBundle(clinicId, bundle);
      emit({ type: 'verify', clinicId, offerId: bundle.offerId, ok: r.ok, reason: r.reason, commitment: r.commitment, today: r.today });
      return json(res, 200, r);
    }
    if (path === '/api/ranking') return json(res, 200, ranking());
    if (path === '/api/ledger') return json(res, 200, { deployment, ledger: await publicLedger(), personas: Object.values(PERSONAS) });
    if (path === '/api/chat' && req.method === 'POST') {
      const { persona, text } = await readBody(req);
      activePersona = persona;
      emit({ type: 'user', text });
      const reply = await runConcierge(persona, text, { baseUrl, emit });
      emit({ type: 'assistant', text: reply });
      return json(res, 200, { reply });
    }
    if (path === '/api/visit' && req.method === 'POST') {
      const { persona, clinicId, procedure } = await readBody(req);
      activePersona = persona;
      emit({ type: 'local', label: `${clinicById(clinicId).name} issues ${procedure} record`, detail: 'append proof → Base Sepolia' });
      const r = await recordVisit(persona, clinicId, procedure, board);
      emit({ type: 'chain', label: 'Record anchored on-chain', tx: r.tx, day: r.day });
      return json(res, 200, r);
    }
    if (path === '/api/review' && req.method === 'POST') {
      const { persona, clinicId, procedure, rating, text } = await readBody(req);
      activePersona = persona;
      const r = await submitPatientReview(persona, clinicId, procedure, { rating, text }, board);
      emit({ type: 'review', clinicId, procedure, ok: r.ok, reason: r.reason });
      return json(res, 200, r);
    }
    if (path === '/api/reset' && req.method === 'POST') {
      const { persona } = await readBody(req);
      resetConversations(persona);
      return json(res, 200, { ok: true });
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    emit({ type: 'error', text: e.message });
    json(res, 500, { error: e.message });
  }
});
server.listen(PORT, () => console.log(`demo on ${baseUrl}`));
