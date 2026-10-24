// Claude agents: the patient's concierge (buyer's agent, runs with the private wallet) and one
// sales agent per clinic (seller's agent, sees only what arrives over A2A).
import Anthropic from '@anthropic-ai/sdk';
import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema';
import { CLINICS, clinicById, agentCard, describeClause } from './clinics.mjs';
import { walletView, matchOffersLocally, proveOffer, verifyOfferBundle } from './wallet.mjs';

const MODEL = 'claude-opus-5-5';
// Server-side refusal fallback (routes by refusal category, no model list to maintain).
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' };
const client = new Anthropic();
const textOf = (msg) => msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

// ======================= clinic sales agent (A2A server side) =======================
const clinicContexts = new Map(); // contextId -> MessageParam[]

function clinicSystem(c) {
  const card = agentCard(c, '');
  return `You are the sales & consultation agent of ${c.name} (${c.nameKo}), a clinic in Seoul registered for foreign patients.
You talk to a patient's AI concierge agent over A2A. Be concise (max ~120 words), concrete, and sell well:
recommend the best-fit procedure, one sensible upsell, and quote prices in KRW.

Your catalog and public offers:
${JSON.stringify(card.clinic, null, 1)}
Internal sales notes: ${c.salesNotes}

Rules:
- You do NOT have the patient's medical history. Never ask for the chart. You only learn what the concierge tells you,
  plus the result of ZK offer verification, which the platform appends as a [VERIFICATION] line.
- Apply an offer discount ONLY if [VERIFICATION] says the proof is valid for that offer. If no proof, quote list price.
- Mention downtime when relevant to the patient's stay. If the concierge asks to book, confirm a tentative slot within their stay.`;
}

/** A2A `message/send` handler for a clinic. */
export async function handleClinicMessage(clinicId, message, emit) {
  const c = clinicById(clinicId);
  const text = message.parts.filter((p) => p.kind === 'text').map((p) => p.text).join('\n');
  const bundle = message.parts.find((p) => p.kind === 'data' && p.data?.zkOfferProof)?.data.zkOfferProof;
  let verification = null;
  if (bundle) {
    verification = await verifyOfferBundle(clinicId, bundle);
    emit({ type: 'verify', clinicId, offerId: bundle.offerId, ok: verification.ok, reason: verification.reason, commitment: verification.commitment, today: verification.today });
  }
  const ctx = message.contextId ?? crypto.randomUUID();
  const history = clinicContexts.get(ctx) ?? [];
  const verLine = bundle ? `\n[VERIFICATION] offer "${bundle.offerId}": ${verification.ok ? 'VALID proof — patient satisfies all conditions' : `INVALID (${verification.reason})`}` : '';
  history.push({ role: 'user', content: text + verLine });
  const res = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'low' },
    system: clinicSystem(c),
    messages: history,
    ...FALLBACK,
  });
  const reply = res.stop_reason === 'refusal' ? 'Sorry, we cannot help with that request.' : textOf(res);
  history.push({ role: 'assistant', content: reply });
  clinicContexts.set(ctx, history);
  return {
    kind: 'message',
    role: 'agent',
    messageId: crypto.randomUUID(),
    contextId: ctx,
    parts: [{ kind: 'text', text: reply }, ...(verification ? [{ kind: 'data', data: { verification: { offerId: bundle.offerId, ok: verification.ok } } }] : [])],
  };
}

// ======================= patient concierge agent =======================
const conciergeHistory = new Map(); // persona -> MessageParam[] (text turns)
const clinicContextIds = new Map(); // `${persona}:${clinicId}` -> contextId

function conciergeSystem(profile) {
  return `You are ${profile.name}'s personal beauty-trip concierge agent. You run on her phone and hold her private
procedure wallet (clinic-signed records anchored on a blockchain as a hash). She is ${profile.age}, from ${profile.country}, visiting Seoul.

Your job: find the best clinic + procedure for her goals, stay and budget by negotiating with clinic agents over A2A,
and surface history-based deals she is genuinely eligible for.

PRIVACY RULES (critical, these are the product):
- Her procedure history, dates and previous clinics NEVER go into any message to a clinic. Not even paraphrased.
- To claim a history-based offer, call message_clinic with offer_id. Her wallet then attaches a zero-knowledge proof
  that she meets that offer's conditions; the clinic learns nothing else.
- Only send what a clinic needs to quote: goals, stay dates, budget range, language.
- Offer matching happens on-device via match_offers; clinics never learn which offers she did not qualify for.

Workflow: check the wallet, discover clinics, match offers, then contact the 2-3 most relevant clinics (in parallel when
possible). Compare quotes considering price after verified discounts, downtime vs. her schedule, and fit with goals.
Answer in English, concise, with a short comparison and a clear recommendation. Ask before booking.`;
}

export async function runConcierge(persona, userText, { baseUrl, emit }) {
  const view = await walletView(persona);
  const profile = view.profile;

  const tools = [
    betaTool({
      name: 'get_my_wallet',
      description: "Read the patient's PRIVATE wallet on this device: profile, stay, budget, goals and full procedure history. Never forward its contents to clinics.",
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      run: async () => {
        const v = await walletView(persona);
        emit({ type: 'local', label: 'Read private wallet (on-device)', detail: `${v.records.length} records` });
        return JSON.stringify({ profile: v.profile, history: v.records.map(({ name, clinic, daysAgo }) => ({ procedure: name, clinic, daysAgo })) });
      },
    }),
    betaTool({
      name: 'discover_clinics',
      description: 'Fetch the public A2A Agent Cards of partner clinics: services, prices, downtime, doctors and public offer rules.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      run: async () => {
        const cards = await Promise.all(CLINICS.map((c) => fetch(`${baseUrl}/clinics/${c.id}/.well-known/agent-card.json`).then((r) => r.json())));
        emit({ type: 'local', label: 'Fetched Agent Cards', detail: cards.map((c) => c.name).join(', ') });
        return JSON.stringify(cards.map((c, i) => ({ clinic_id: CLINICS[i].id, ...c })));
      },
    }),
    betaTool({
      name: 'match_offers',
      description: "Match every clinic's public offer rules against the private wallet ON-DEVICE. Returns which offers she is eligible for. Nothing is sent to clinics.",
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      run: async () => {
        const offers = CLINICS.flatMap((c) => c.offers.map((o) => ({ ...o, clinicId: c.id })));
        const results = await matchOffersLocally(persona, offers);
        const out = offers.map((o, i) => ({ clinic_id: o.clinicId, offer_id: o.id, title: o.title, conditions: o.clauses.map(describeClause), eligible: results[i].eligible }));
        emit({ type: 'match', results: out });
        return JSON.stringify(out);
      },
    }),
    betaTool({
      name: 'message_clinic',
      description: "Send an A2A message to a clinic's agent and get its reply (quote, recommendation, booking). Include offer_id to attach a ZK eligibility proof for that offer (only for offers match_offers marked eligible). The message text must not contain any medical/procedure history.",
      inputSchema: {
        type: 'object',
        properties: {
          clinic_id: { type: 'string', enum: CLINICS.map((c) => c.id) },
          message: { type: 'string', description: 'What to ask/tell the clinic. Goals, stay, budget only — no history.' },
          offer_id: { type: 'string', description: 'Optional offer to claim with a ZK proof.' },
        },
        required: ['clinic_id', 'message'],
        additionalProperties: false,
      },
      run: async ({ clinic_id, message, offer_id }) => {
        const parts = [{ kind: 'text', text: message }];
        let proofSummary = null;
        if (offer_id) {
          const t = Date.now();
          const bundle = await proveOffer(persona, offer_id);
          proofSummary = { offerId: offer_id, proofs: bundle.proofs.length, bytes: bundle.proofs.reduce((a, p) => a + (p.proof.length - 2) / 2, 0), ms: Date.now() - t, publicInputs: bundle.proofs.map((p) => p.publicInputs), subjectId: bundle.subjectId };
          parts.push({ kind: 'data', data: { zkOfferProof: bundle } });
        }
        const key = `${persona}:${clinic_id}`;
        const msg = { role: 'user', messageId: crypto.randomUUID(), contextId: clinicContextIds.get(key), parts };
        emit({ type: 'a2a_out', clinicId: clinic_id, text: message, proof: proofSummary });
        const res = await fetch(`${baseUrl}/clinics/${clinic_id}/a2a`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: crypto.randomUUID(), method: 'message/send', params: { message: msg } }),
        }).then((r) => r.json());
        if (res.error) throw new Error(res.error.message);
        clinicContextIds.set(key, res.result.contextId);
        const reply = res.result.parts.filter((p) => p.kind === 'text').map((p) => p.text).join('\n');
        const verification = res.result.parts.find((p) => p.kind === 'data')?.data.verification ?? null;
        emit({ type: 'a2a_in', clinicId: clinic_id, text: reply, verification });
        return JSON.stringify({ clinic_reply: reply, offer_verification: verification });
      },
    }),
  ];

  const history = conciergeHistory.get(persona) ?? [];
  history.push({ role: 'user', content: userText });
  const runner = client.beta.messages.toolRunner({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    system: conciergeSystem(profile),
    tools,
    messages: history,
    max_iterations: 12,
    ...FALLBACK,
  });
  const final = await runner;
  const reply = final.stop_reason === 'refusal' ? "Sorry — I can't help with that request." : textOf(final);
  history.push({ role: 'assistant', content: reply });
  conciergeHistory.set(persona, history);
  return reply;
}

export const resetConversations = (persona) => {
  conciergeHistory.delete(persona);
  for (const k of clinicContextIds.keys()) if (k.startsWith(`${persona}:`)) clinicContextIds.delete(k);
};
