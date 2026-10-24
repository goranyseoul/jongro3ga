const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (h, n = 6) => (h && h.length > 2 * n + 2 ? `${h.slice(0, n + 2)}…${h.slice(-n)}` : h);
const krw = (n) => `₩${Number(n).toLocaleString('ko-KR')}`;
const time = (t) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const api = async (path, body) => {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? r.statusText);
  return j;
};

const CHIPS = {
  yuki: ["I'm in Seoul Nov 2–6 and want glowing, plump skin with zero downtime — I have a wedding on Nov 9. Any deals for me?"],
  lin: ['I want a stronger jawline lift than Thermage gave me. In Seoul Nov 3–5, budget around ₩2M.'],
  emily: ["First time in Korea! I'd like brighter, more even skin. What would you recommend for an 8-day stay?"],
};
const CLAUSE_NAMES = ['', 'REJURAN', 'FILLER', 'BOTOX', 'THERMAGE', 'ULTHERA', 'EXOSOME', 'LASER_TONING'];

let state = null;
let persona = 'yuki';
const chats = {}; // persona -> [{role, text}]
const clinicName = (id) => state?.clinics.find((c) => c.url.endsWith(`/${id}/a2a`))?.name ?? id;

async function load() {
  state = await api(`/api/state?persona=${persona}`);
  render();
}

function render() {
  const { wallet, personas, clinics, deployment } = state;
  $('#personas').innerHTML = personas.map((p) => `<button class="persona ${p.id === persona ? 'active' : ''}" data-p="${p.id}">${p.flag} ${p.name}</button>`).join('');
  $('#chain-pill').innerHTML = `Base Sepolia · demo day <b>${wallet.today}</b> · <a href="https://sepolia.basescan.org/address/${deployment.registry}" target="_blank">registry ${short(deployment.registry, 4)}</a>`;
  const p = wallet.profile;
  $('#profile').innerHTML = `<div class="name">${p.flag} ${p.name}, ${p.age}</div>
    <dl><dt>체류</dt><dd>${esc(p.stay)}</dd><dt>예산</dt><dd>${krw(p.budgetKRW)}</dd><dt>목표</dt><dd>${esc(p.goals)}</dd></dl>`;
  $('#records').innerHTML = wallet.records.length
    ? wallet.records.map((r) => `<li><div><div>${esc(r.name)}</div><div class="clinic">${esc(r.clinic)}</div></div><span class="ago">${r.daysAgo}일 전</span></li>`).join('')
    : '<li class="muted">기록 없음</li>';
  const o = wallet.onchain;
  $('#anchor').innerHTML = `<div class="kv">
      <span>가명 ID</span><span class="hash">${short(o.subjectId, 8)}</span>
      <span>차트 해시</span><span class="hash">${BigInt(o.commitment) === 0n ? '— (없음)' : short(o.commitment, 10)}</span>
      <span>버전</span><span>${o.version}</span></div>
    <p class="explain">시술 종류·날짜·병원은 체인에 없습니다. 해시는 무작위 salt로 가려져 있고, 갱신마다 ZK 추가증명을 컨트랙트가 검증합니다.</p>`;
  $('#visit-clinic').innerHTML = clinics.map((c) => `<option value="${c.url.split('/').at(-2)}">${esc(c.name)}</option>`).join('');
  syncVisitProcs();
  renderReviewBox();
  $('#chat-title').textContent = `${p.name}의 컨시어지`;
  $('#input').placeholder = `${p.name}: what are you looking for on this trip?`;
  $('#chips').innerHTML = (CHIPS[persona] ?? []).map((t) => `<button class="chip">${esc(t)}</button>`).join('');
  renderMessages();
  renderRanking();
}

function syncVisitProcs() {
  const id = $('#visit-clinic').value;
  const c = state.clinics.find((x) => x.url.endsWith(`/${id}/a2a`));
  $('#visit-proc').innerHTML = c.clinic.services.map((s) => `<option value="${s.procedure}">${esc(s.name)}</option>`).join('');
}

function renderReviewBox() {
  const pending = state.wallet.pendingReviews;
  if (!pending.length) { $('#review-box').innerHTML = ''; return; }
  const t = pending[0];
  $('#review-box').innerHTML = `<div class="card"><div class="card-title">리뷰 티켓 · ${esc(clinicName(t.clinicId))} · ${t.procedure}</div>
    <div class="review-form"><div class="stars" data-v="5">${'★'.repeat(5).split('').map((s, i) => `<span data-i="${i + 1}" class="on">★</span>`).join('')}</div>
    <textarea id="review-text" rows="2" placeholder="익명 리뷰 (Semaphore 증명으로 실제 방문자만 작성)"></textarea>
    <button class="btn ghost" id="review-btn" data-c="${t.clinicId}" data-p="${t.procedure}">익명 리뷰 제출</button></div></div>`;
}

function renderMessages() {
  const list = chats[persona] ?? [];
  $('#messages').innerHTML = list.map((m) => `<div class="msg ${m.role}">${m.role === 'assistant' ? md(m.text) : esc(m.text)}</div>`).join('');
  $('#messages').scrollTop = 1e9;
}
const md = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^#+ (.*)$/gm, '<strong>$1</strong>');

function renderRanking() {
  $('#rank').innerHTML = `<p class="explain">순위 = 검증된 방문 수 (병원이 발급한 방문 티켓 수). 리뷰는 Semaphore 증명으로 실제 방문자만, 시술당 1회, 익명으로 작성되며 같은 시술 방문자가 3명 이상일 때만 공개됩니다.</p>` +
    state.ranking.map((r, i) => `<div class="rank-card"><div class="head"><span class="pos">${i + 1}</span>
      <div><div class="nm">${esc(r.name)}</div><div class="muted">${esc(r.nameKo)} · ${esc(r.area)}</div></div>
      <div class="stats"><b>${r.verifiedVisits}</b> 검증 방문<br>${r.avgRating ? `★ ${r.avgRating}` : '—'} · 리뷰 ${r.reviews.length}${r.pendingReviews ? ` (+${r.pendingReviews} 대기)` : ''}</div></div>
      ${r.reviews.slice(0, 3).map((v) => `<div class="review"><div class="meta">✓ 검증된 방문자 · ${v.procedure} · ${'★'.repeat(v.rating)}</div>${esc(v.text)}</div>`).join('')}</div>`).join('');
}

// ---------- A2A event log ----------
function logEvent(e) {
  if (e.persona && e.persona !== persona) return;
  const t = `<time>${time(e.at)}</time>`;
  let html = '';
  switch (e.type) {
    case 'local':
      html = `<div class="ev local"><div class="h"><span>📱 ON-DEVICE · ${esc(e.label)}</span>${t}</div>${esc(e.detail ?? '')}<div class="muted">네트워크로 아무것도 나가지 않음</div></div>`;
      break;
    case 'match':
      html = `<div class="ev local"><div class="h"><span>📱 ON-DEVICE · 오퍼 매칭</span>${t}</div>${e.results.map((r) => `<div class="match"><span>${esc(r.title)}<br><span class="muted">${esc(r.conditions.join(' · '))}</span></span><span class="${r.eligible ? 'yes' : 'no'}">${r.eligible ? '대상' : '해당 없음'}</span></div>`).join('')}<div class="muted">병원은 어떤 오퍼가 '해당 없음'이었는지 모릅니다</div></div>`;
      break;
    case 'a2a_out':
      html = `<div class="ev out"><div class="h"><span>→ ${esc(clinicName(e.clinicId))} 가 받은 메시지</span>${t}</div><div class="text">${esc(e.text)}</div>${e.proof ? proofHtml(e.proof) : ''}</div>`;
      break;
    case 'verify':
      html = `<div class="ev ${e.ok ? 'ok' : 'bad'}"><div class="h"><span>${e.ok ? '✓' : '✗'} ${esc(clinicName(e.clinicId))} · ZK 검증 ${e.ok ? '통과' : '실패'}</span>${t}</div>${esc(e.reason)}<br><span class="muted">온체인 해시 ${short(e.commitment, 8)} 기준 · 차트는 보지 않음</span></div>`;
      break;
    case 'a2a_in':
      html = `<div class="ev in"><div class="h"><span>← ${esc(clinicName(e.clinicId))} 에이전트</span>${t}</div><div class="text">${esc(e.text)}</div></div>`;
      break;
    case 'chain':
      html = `<div class="ev chain"><div class="h"><span>⛓ ${esc(e.label)}</span>${t}</div>day ${e.day} · <a href="https://sepolia.basescan.org/tx/${e.tx}" target="_blank">${short(e.tx, 8)}</a></div>`;
      break;
    case 'review':
      html = `<div class="ev ${e.ok ? 'ok' : 'bad'}"><div class="h"><span>${e.ok ? '✓ 익명 리뷰 등록' : '✗ 리뷰 거부'}</span>${t}</div>${esc(e.ok ? `${clinicName(e.clinicId)} · ${e.procedure}` : e.reason)}</div>`;
      break;
    case 'error':
      html = `<div class="ev bad"><div class="h"><span>error</span>${t}</div>${esc(e.text)}</div>`;
      break;
    default:
      return;
  }
  $('#log').insertAdjacentHTML('afterbegin', html);
}
function proofHtml(p) {
  const rows = p.publicInputs.map((pi, i) => {
    const [commitment, today, type, minD, maxD, minC, maxC] = pi.map((x) => BigInt(x));
    const cond = maxC === 0n ? `${CLAUSE_NAMES[Number(type)]} = 0회 (최근 ${maxD}일)` : `${CLAUSE_NAMES[Number(type)]} ≥ ${minC}회`;
    return `<tr><td>proof ${i + 1}</td><td>${cond}</td></tr>`;
  }).join('');
  const c = p.publicInputs[0][0];
  return `<div class="proof"><div class="t">🔐 ZK proof 첨부 · ${p.proofs}개 · ${(p.bytes / 1024).toFixed(1)}KB · 생성 ${p.ms}ms</div>
    <table><tr><td>offer</td><td>${esc(p.offerId)}</td></tr><tr><td>subject</td><td>${short(p.subjectId, 6)}</td></tr><tr><td>commitment</td><td>${short(c, 8)}</td></tr><tr><td>day</td><td>${BigInt(p.publicInputs[0][1])}</td></tr>${rows}</table>
    <div class="muted" style="margin-top:4px">병원이 아는 것은 이게 전부입니다 — 시술 날짜·병원·횟수 원본 없음</div></div>`;
}

// ---------- actions ----------
async function send(text) {
  if (!text.trim()) return;
  (chats[persona] ??= []).push({ role: 'user', text });
  chats[persona].push({ role: 'assistant thinking', text: '컨시어지가 병원 에이전트들과 협상 중…' });
  renderMessages();
  $('#send').disabled = true;
  try {
    const { reply } = await api('/api/chat', { persona, text });
    chats[persona].pop();
    chats[persona].push({ role: 'assistant', text: reply });
  } catch (e) {
    chats[persona].pop();
    chats[persona].push({ role: 'assistant', text: `⚠️ ${e.message}` });
  } finally {
    $('#send').disabled = false;
    renderMessages();
  }
}

document.addEventListener('click', async (ev) => {
  const t = ev.target;
  if (t.matches('.persona')) { persona = t.dataset.p; $('#log').innerHTML = ''; await load(); }
  if (t.matches('.chip')) send(t.textContent);
  if (t.matches('.tab')) {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    $('#log').classList.toggle('hidden', t.dataset.tab !== 'log');
    $('#rank').classList.toggle('hidden', t.dataset.tab !== 'rank');
  }
  if (t.matches('.stars span')) {
    const v = Number(t.dataset.i);
    t.parentElement.dataset.v = v;
    t.parentElement.querySelectorAll('span').forEach((s) => s.classList.toggle('on', Number(s.dataset.i) <= v));
  }
  if (t.id === 'review-btn') {
    t.disabled = true;
    try {
      await api('/api/review', { persona, clinicId: t.dataset.c, procedure: t.dataset.p, rating: Number(document.querySelector('.stars').dataset.v), text: $('#review-text').value || 'Great experience.' });
    } catch (e) { alert(e.message); }
    await load();
  }
  if (t.id === 'visit-btn') {
    t.disabled = true;
    t.textContent = '증명 생성 · 온체인 기록 중…';
    try { await api('/api/visit', { persona, clinicId: $('#visit-clinic').value, procedure: $('#visit-proc').value }); }
    catch (e) { alert(e.message); }
    t.disabled = false;
    t.textContent = '기록 발급 (append proof → on-chain)';
    await load();
  }
  if (t.id === 'reset-btn') { chats[persona] = []; await api('/api/reset', { persona }); renderMessages(); $('#log').innerHTML = ''; }
});
$('#visit-clinic').addEventListener('change', syncVisitProcs);
$('#composer').addEventListener('submit', (e) => { e.preventDefault(); const v = $('#input').value; $('#input').value = ''; send(v); });
$('#input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#composer').requestSubmit(); } });

new EventSource('/api/events').onmessage = (m) => logEvent(JSON.parse(m.data));
setInterval(async () => { try { const s = await api(`/api/state?persona=${persona}`); state = s; const { wallet } = s; $('#chain-pill b').textContent = wallet.today; $('#records').innerHTML = wallet.records.length ? wallet.records.map((r) => `<li><div><div>${esc(r.name)}</div><div class="clinic">${esc(r.clinic)}</div></div><span class="ago">${r.daysAgo}일 전</span></li>`).join('') : '<li class="muted">기록 없음</li>'; } catch {} }, 15000);
load();
