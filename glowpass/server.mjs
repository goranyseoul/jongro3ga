// Pibu ZK record layer: HTTP API for the A2A agents + demo console UI + SSE event stream.
// Usage: cd glowpass && npm start   (port 4000 so it can run next to the Next.js app on 3000;
// the relayer key for /api/records/visit comes from chain/.env)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { PERSONAS, PROCEDURES, CLINICS, OFFERS, describeClause } from './catalog.mjs';
import { publicLedger, walletView, importSelfReported, resetPersona, matchOffers, proveOffer, verifyOfferBundle, recordVisit, submitPatientReview, deployment } from './wallet.mjs';
import { seedReviewBoard } from './reviews-seed.mjs';

const chainEnv = new URL('../chain/.env', import.meta.url);
if (existsSync(chainEnv)) process.loadEnvFile(chainEnv);

const PORT = Number(process.env.PORT ?? 4000);
const { board, ready } = seedReviewBoard();
ready.then(() => console.log('seed reviews proven'));

// ---------- SSE: lets the demo console show calls made by other agents too ----------
const subscribers = new Set();
const emit = (e) => {
  const data = `data: ${JSON.stringify({ at: Date.now(), ...e })}\n\n`;
  for (const res of subscribers) res.write(data);
};

const json = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'access-control-allow-origin': '*' }); res.end(JSON.stringify(body)); };
const readBody = async (req) => { let b = ''; for await (const c of req) b += c; return b ? JSON.parse(b) : {}; };
const STATIC = {
  '/': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'],
  '/ledger': ['ledger.html', 'text/html'], '/ledger.js': ['ledger.js', 'text/javascript'],
};

function stats() {
  const s = board.stats();
  const clinics = Object.entries(CLINICS).map(([clinicId, c]) => {
    const x = s.find((y) => y.clinicId === clinicId) ?? { verifiedVisits: 0, procedures: {} };
    const reviews = Object.entries(x.procedures).flatMap(([procedureId, p]) => p.reviews.map((r) => ({ ...r, procedureId, procedure: PROCEDURES[procedureId].ko })));
    return {
      clinicId, clinic: c.ko, area: c.area, languages: c.languages,
      verifiedVisits: x.verifiedVisits,
      byProcedure: Object.fromEntries(Object.entries(x.procedures).map(([p, v]) => [p, v.verifiedVisits])),
      avgRating: reviews.length ? +(reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1) : null,
      reviews,
    };
  }).sort((a, b) => b.verifiedVisits - a.verifiedVisits);
  const procedures = Object.fromEntries(Object.keys(PROCEDURES).map((p) => [p, clinics.reduce((a, c) => a + (c.byProcedure[p] ?? 0), 0)]));
  return { clinics, verifiedUsersByProcedure: procedures };
}

const publicOffers = () => OFFERS.map((o) => ({ ...o, clinic: CLINICS[o.clinicId].ko, conditions: o.clauses.map(describeClause) }));

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  // tag events with the caller so the demo console can tell its own calls from other agents'
  const send = (e) => emit({ client: req.headers['x-client-id'], ...e });
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type' }); return res.end(); }
  try {
    if (req.method === 'GET' && STATIC[path]) {
      const [file, type] = STATIC[path];
      res.writeHead(200, { 'content-type': `${type}; charset=utf-8` });
      return res.end(await readFile(new URL(`public/${file}`, import.meta.url)));
    }
    if (path === '/api/events') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'access-control-allow-origin': '*' });
      res.write(': connected\n\n');
      subscribers.add(res);
      return req.on('close', () => subscribers.delete(res));
    }

    // ----- public -----
    if (path === '/api/offers') return json(res, 200, publicOffers());
    if (path === '/api/stats') return json(res, 200, stats());
    if (path === '/api/ledger') return json(res, 200, { deployment, ledger: await publicLedger(), personas: Object.values(PERSONAS) });

    // ----- customer agent (on-device role) -----
    let m = path.match(/^\/api\/wallet\/(\w+)$/);
    if (m && req.method === 'GET') return json(res, 200, await walletView(m[1]));
    m = path.match(/^\/api\/wallet\/(\w+)\/self-reported$/);
    if (m && req.method === 'POST') {
      const { records } = await readBody(req);
      return json(res, 200, importSelfReported(m[1], records));
    }
    m = path.match(/^\/api\/wallet\/(\w+)\/reset$/);
    if (m && req.method === 'POST') {
      const r = await resetPersona(m[1], board);
      send({ type: 'reset', persona: m[1], ...r });
      return json(res, 200, r);
    }
    if (path === '/api/zk/match-offers' && req.method === 'POST') {
      const { persona } = await readBody(req);
      const results = await matchOffers(persona);
      send({ type: 'match', persona, results });
      return json(res, 200, results);
    }
    if (path === '/api/zk/prove-offer' && req.method === 'POST') {
      const { persona, offerId } = await readBody(req);
      const bundle = await proveOffer(persona, offerId);
      send({ type: 'prove', persona, offerId, clinicId: OFFERS.find((o) => o.id === offerId).clinicId, subjectId: bundle.subjectId, provingMs: bundle.provingMs, publicInputs: bundle.proofs.map((p) => p.publicInputs), bytes: bundle.proofs.reduce((a, p) => a + (p.proof.length - 2) / 2, 0) });
      return json(res, 200, bundle);
    }

    // ----- clinic agent -----
    if (path === '/api/zk/verify-offer' && req.method === 'POST') {
      const { clinicId, bundle } = await readBody(req);
      const r = await verifyOfferBundle(clinicId, bundle);
      send({ type: 'verify', clinicId, clinic: CLINICS[clinicId]?.ko, offerId: bundle.offerId, ...r });
      return json(res, 200, r);
    }

    // ----- platform -----
    if ((path === '/api/records/visit' || path === '/api/visit') && req.method === 'POST') {
      const { persona, clinicId, procedureId } = await readBody(req);
      send({ type: 'visit_start', persona, clinic: CLINICS[clinicId]?.ko, procedure: PROCEDURES[procedureId]?.ko });
      const r = await recordVisit(persona, clinicId, procedureId, board);
      send({ type: 'chain', persona, clinic: CLINICS[clinicId].ko, procedure: PROCEDURES[procedureId].ko, ...r });
      return json(res, 200, r);
    }
    if ((path === '/api/reviews' || path === '/api/review') && req.method === 'POST') {
      const { persona, clinicId, procedureId, rating, text } = await readBody(req);
      const r = await submitPatientReview(persona, clinicId, procedureId, { rating, text }, board);
      send({ type: 'review', persona, clinic: CLINICS[clinicId].ko, procedure: PROCEDURES[procedureId].ko, ...r });
      return json(res, 200, r);
    }

    // ----- demo console -----
    if (path === '/api/state') {
      const persona = url.searchParams.get('persona') ?? 'cus_yuki';
      return json(res, 200, { personas: Object.values(PERSONAS), wallet: await walletView(persona), offers: publicOffers(), stats: stats(), deployment, procedures: PROCEDURES, clinics: CLINICS });
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    console.error(e);
    send({ type: 'error', text: e.message });
    json(res, 500, { error: e.message.split('\n')[0] });
  }
});
server.listen(PORT, () => console.log(`Pibu ZK record layer on http://localhost:${PORT}`));
