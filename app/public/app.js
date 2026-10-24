const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (h, n = 6) => (h && h.length > 2 * n + 2 ? `${h.slice(0, n + 2)}…${h.slice(-n)}` : h);
const time = (t) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const CLIENT = crypto.randomUUID();
const params = new URLSearchParams(location.search);
const api = async (path, body) => {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-client-id': CLIENT }, body: JSON.stringify(body) } : { headers: { 'x-client-id': CLIENT } });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error ?? r.statusText);
  return j;
};

let state = null;
let persona = params.get('persona') ?? 'cus_yuki';
const procName = (id) => state.procedures[id]?.ko ?? id;
const clinicName = (id) => state.clinics[id]?.ko ?? id;
const codeToProc = () => Object.fromEntries(Object.entries(state.procedures).map(([id, p]) => [p.code, p.ko]));
const codeToClinic = () => Object.fromEntries(Object.entries(state.clinics).map(([id, c]) => [c.code, c.ko]));

async function load(p = persona) {
  persona = p;
  state = await api(`/api/state?persona=${persona}`);
  render();
}

// ---------------- rendering ----------------
function render() {
  const { wallet, personas, deployment } = state;
  $('#personas').innerHTML = personas.map((p) => `<button class="persona ${p.id === persona ? 'active' : ''}" data-p="${p.id}">${p.flag} ${p.name}</button>`).join('');
  $('#chain-pill').innerHTML = `Base Sepolia · day <b>${wallet.today}</b> · <a href="https://sepolia.basescan.org/address/${deployment.registry}" target="_blank">${short(deployment.registry, 4)}</a>`;
  const p = wallet.profile;
  $('#profile').innerHTML = `<div class="name">${p.flag} ${esc(p.name)}, ${p.age} · ${esc(p.home)}</div><div class="muted" style="margin-top:4px">${esc(p.note)}</div>`;
  $('#verified').innerHTML = wallet.verifiedRecords.length
    ? wallet.verifiedRecords.map((r) => `<li><div><div>${esc(r.procedure)}</div><div class="clinic">${esc(r.clinic)} · <a href="https://sepolia.basescan.org/tx/${r.tx}" target="_blank">tx ${short(r.tx, 3)}</a></div></div><span class="ago">${r.daysAgo}일 전</span></li>`).join('')
    : '<li class="muted">아직 없음</li>';
  const self = wallet.selfReported;
  $('#self-box').classList.toggle('hidden', !self.length);
  $('#self-title').innerHTML = `✎ 자기 신고 기록 ${self.length}건 <span class="muted">· 메모장 가져오기 · 체인 X · 증명 X</span>`;
  $('#self').innerHTML = self.map((r) => `<li><div><div>${esc(r.procedure)} ${esc(r.amount)}</div><div class="clinic">${esc(r.where)}</div></div><span class="date">${esc(r.date)}${r.yearInferred ? ' <span title="연도 추정">?</span>' : ''}</span></li>`).join('');
  const o = wallet.onchain;
  $('#anchor').innerHTML = `<div class="kv">
      <span>가명 ID</span><span class="hash">${short(o.subjectId, 8)}</span>
      <span>차트 해시</span><span class="hash">${BigInt(o.commitment) === 0n ? '— (없음)' : short(o.commitment, 10)}</span>
      <span>버전</span><span>${o.version}</span></div>
    <p class="explain">시술 종류·날짜·병원·자기 신고 기록은 체인에 없습니다.</p>`;
  $('#visit-clinic').innerHTML = Object.entries(state.clinics).map(([id, c]) => `<option value="${id}">${esc(c.ko)}</option>`).join('');
  $('#visit-proc').innerHTML = Object.entries(state.procedures).map(([id, x]) => `<option value="${id}">${esc(x.ko)}</option>`).join('');
  renderScenes();
  renderOffers();
  renderReviewBox();
  renderRanking();
}

function renderOffers() {
  if (!state.match) { $('#offers').innerHTML = `<button class="btn tiny ghost" data-act="match">기기 안에서 오퍼 매칭</button>`; return; }
  $('#offers').innerHTML = state.match.map((o) => `<div class="offer ${o.eligible ? 'ok' : ''}">
      <div><b>${esc(o.clinic)}</b> · ${esc(o.title)}<div class="muted">${esc(o.conditions.join(' & '))}</div></div>
      ${o.eligible ? `<button class="btn tiny primary" data-act="claim" data-offer="${o.offerId}" data-clinic="${o.clinicId}">증명 보내기</button>` : '<span class="no">해당 없음</span>'}</div>`).join('');
}

function renderReviewBox() {
  const t = state.wallet.pendingReviews[0];
  if (!t) { $('#review-box').innerHTML = ''; return; }
  $('#review-box').innerHTML = `<div class="card"><div class="card-title">🎟 리뷰 티켓 · ${esc(t.clinic)} · ${esc(t.procedure)} <span class="muted">(방문자만 · 익명 · 1회)</span></div>
    <div class="review-form"><textarea id="review-text" rows="2">아파… 그래도 3주 뒤 결이 매끈해졌어요.</textarea>
    <button class="btn ghost" data-act="review" data-clinic="${t.clinicId}" data-proc="${t.procedureId}">익명 리뷰 남기기 (Semaphore 증명)</button></div></div>`;
}

function renderRanking() {
  const s = state.stats;
  const top = Object.entries(s.verifiedUsersByProcedure).filter(([, n]) => n).sort((a, b) => b[1] - a[1]);
  $('#rank').innerHTML = `<div class="statgrid">${top.map(([p, n]) => `<div class="stat"><b>${n.toLocaleString()}</b><span>${esc(procName(p))}</span></div>`).join('')}</div>
    <p class="explain">"피북 사용자 N명 받음" = 병원이 시술을 확인해 발급한 방문 티켓 수. 리뷰는 티켓 보유자만 익명으로, 시술당 1회 (Semaphore). 플랫폼도 리뷰를 고칠 수 없습니다.</p>` +
    s.clinics.map((c, i) => `<div class="rank-card"><div class="head"><span class="pos">${i + 1}</span>
      <div><div class="nm">${esc(c.clinic)}</div><div class="muted">${esc(c.area)} · ${c.languages.join('/')}</div></div>
      <div class="stats"><b>${c.verifiedVisits.toLocaleString()}</b> 검증 방문<br>${c.avgRating ? `★ ${c.avgRating}` : '—'} · 리뷰 ${c.reviews.length}</div></div>
      ${c.reviews.slice(0, 2).map((v) => `<div class="review"><div class="meta">✓ 검증된 방문자 · ${esc(v.procedure)} · ${'★'.repeat(v.rating)}</div>${esc(v.text)}</div>`).join('')}</div>`).join('');
}

// ---------------- scenes (DEMO.md) ----------------
const SCENES = [
  {
    n: '①', persona: 'cus_yuki', title: '유키 ⑥ "2회차 하실래요?"',
    desc: '쥬베룩 1회차를 맞은 유키에게 병원들이 2회차 오퍼로 경쟁. 병원은 "1회 완료 · 28일 경과"만 확인하고 언제·어디서 맞았는지는 모름.',
    actions: [['2회차 오퍼 증명 → 강남 B의원·홍대 A의원', 'scene1']],
    status: () => {
      const r = state.wallet.verifiedRecords.find((x) => x.procedureId === 'skin_booster_juvelook');
      if (!r) return '유키의 1회차 기록이 아직 없음';
      return r.daysAgo >= 28 ? `1회차 ${r.daysAgo}일 경과 → 2회차 오퍼 대상` : `1회차 ${r.daysAgo}일 경과 · <b>${28 - r.daysAgo}일(=${28 - r.daysAgo}분) 뒤</b> 2회차 오퍼 대상`;
    },
  },
  {
    n: '②', persona: 'cus_jisoo', title: '지수 ④ "첫 방문 10% 할인"',
    desc: '"이 병원 첫 방문"을 차트 공개 없이 증명. 시술 후엔 기록이 체인에 앵커되어 같은 할인을 두 번 받을 수 없음.',
    actions: [['첫 방문 증명 → 역삼 I의원', 'scene2a'], ['예약 → 시술 완료 (기록 발급)', 'scene2b'], ['첫 방문 할인 다시 시도', 'scene2c']],
  },
  {
    n: '③', persona: 'cus_jisoo', title: '"피북 사용자 N명 받음"의 근거',
    desc: '방문 수·후기는 병원이 확인한 방문 티켓에서만 나옴. 개인을 드러내지 않고, 플랫폼도 숫자·후기를 조작할 수 없음.',
    actions: [['검증 방문 · 리뷰 보기', 'scene3a'], ['익명 리뷰 남기기 → 한 번 더 시도', 'scene3b']],
  },
  {
    n: '④', persona: 'cus_jisoo', title: '지수 ① 메모장 기록 vs 병원 확인 기록',
    desc: '메모장에서 가져온 2년치 기록은 지갑에 보이지만 "자기 신고". 리쥬란을 메모에 7번 적어도 "리쥬란 3회 이상" 증명엔 병원 확인 기록만 센다.',
    actions: [['단골가 오퍼 (리쥬란 3회 이상) 시도', 'scene4']],
  },
];

function renderScenes() {
  $('#scene-list').innerHTML = SCENES.map((s) => `<div class="scene ${s.persona === persona ? 'current' : ''}">
    <div class="scene-head"><span class="scene-n">${s.n}</span><b>${esc(s.title)}</b><span class="muted">${esc(state.personas.find((p) => p.id === s.persona).flag)}</span></div>
    <div class="scene-desc">${esc(s.desc)}</div>
    ${s.status && s.persona === persona ? `<div class="scene-status">${s.status()}</div>` : ''}
    <div class="scene-actions">${s.actions.map(([label, act]) => `<button class="btn tiny ${s.persona === persona ? 'primary' : 'ghost'}" data-act="${act}" data-persona="${s.persona}">${esc(label)}</button>`).join('')}</div></div>`).join('');
}

// ---------------- log (what leaves the device) ----------------
function log(html) { $('#log').insertAdjacentHTML('afterbegin', html); }
const ev = (cls, head, body) => log(`<div class="ev ${cls}"><div class="h"><span>${head}</span><time>${time(Date.now())}</time></div>${body}</div>`);

function proofCard(bundle, offer) {
  const P = codeToProc(), C = codeToClinic();
  const rows = bundle.proofs.map((p, i) => {
    const [, , type, clinic, minD, maxD, minC, maxC] = p.publicInputs.map((x) => BigInt(x));
    const what = `${type ? P[Number(type)] : '시술 무관'}${clinic ? ` @ ${C[Number(clinic)]}` : ''}`;
    const win = maxD < 100000n ? ` (최근 ${maxD}일)` : '';
    const cnt = maxC === 0n ? '0건' : minC === maxC ? `정확히 ${minC}회` : `${minC}회 이상`;
    return `<tr><td>조건 ${i + 1}</td><td>${esc(what + win)} ${cnt}</td></tr>`;
  }).join('');
  const bytes = bundle.proofs.reduce((a, p) => a + (p.proof.length - 2) / 2, 0);
  return `<div class="proof"><div class="t">🔐 ZK 증명 ${bundle.proofs.length}개 · ${(bytes / 1024).toFixed(1)}KB · 생성 ${bundle.provingMs}ms</div>
    <table><tr><td>오퍼</td><td>${esc(offer)}</td></tr><tr><td>가명</td><td>${short(bundle.subjectId, 6)}</td></tr><tr><td>차트 해시</td><td>${short(bundle.proofs[0].publicInputs[0], 8)}</td></tr>${rows}</table>
    <div class="muted" style="margin-top:4px">병원이 받는 건 이게 전부 — 시술 날짜·병원·횟수 원본 없음</div></div>`;
}

async function claim(offerId, clinicId) {
  const offer = state.offers.find((o) => o.id === offerId);
  ev('local', `📱 기기 안에서 증명 생성 · ${esc(offer.title)}`, '차트 원본은 기기를 떠나지 않음');
  let bundle;
  try { bundle = await api('/api/zk/prove-offer', { persona, offerId }); }
  catch (e) { ev('bad', `✗ 증명을 만들 수 없음 · ${esc(offer.title)}`, `조건을 만족하지 않는 차트로는 증명이 생성되지 않습니다 <span class="muted">(${esc(e.message)})</span>`); return false; }
  ev('out', `→ ${esc(clinicName(clinicId))} 가 받은 것`, proofCard(bundle, offer.title));
  const v = await api('/api/zk/verify-offer', { clinicId, bundle });
  ev(v.ok ? 'ok' : 'bad', `${v.ok ? '✓' : '✗'} ${esc(clinicName(clinicId))} · 검증 ${v.ok ? '통과 → ' + esc(offer.benefit) : '실패'}`, `${esc(v.reason)}<br><span class="muted">온체인 해시 ${short(v.commitment, 8)} 기준 · 차트는 보지 않음</span>`);
  return v.ok;
}

async function matchLocal(note = true) {
  state.match = await api('/api/zk/match-offers', { persona });
  if (note) ev('local', '📱 기기 안에서 오퍼 매칭', state.match.map((o) => `<div class="match"><span>${esc(o.clinic)} · ${esc(o.title)}</span><span class="${o.eligible ? 'yes' : 'no'}">${o.eligible ? '대상' : '해당 없음'}</span></div>`).join('') + '<div class="muted">병원으로 아무것도 나가지 않음</div>');
  renderOffers();
}

const ACTIONS = {
  match: () => matchLocal(),
  async scene1() {
    await matchLocal();
    for (const id of ['ofr_gangnam_b_juvelook_package', 'ofr_hongdae_a_juvelook_continue']) {
      const o = state.offers.find((x) => x.id === id);
      if (!state.match.find((m) => m.offerId === id).eligible) { ev('local', `📱 ${esc(o.clinic)} 오퍼는 아직 대상 아님`, '자격이 없으면 증명을 보내지 않음 → 병원은 유키가 검토했다는 사실도 모름'); continue; }
      await claim(id, o.clinicId);
    }
  },
  scene2a: () => claim('ofr_yeoksam_i_first_visit', 'cln_yeoksam_i'),
  async scene2b() {
    ev('local', '🏥 역삼 I의원 · 리투오 시술 완료', '병원 확인 → append 증명 생성 → 플랫폼이 Base Sepolia에 기록 (약 10초)');
    const r = await api('/api/records/visit', { persona, clinicId: 'cln_yeoksam_i', procedureId: 'rituo' });
    ev('chain', '⛓ 병원 확인 기록이 체인에 앵커됨', `가명의 차트 해시만 갱신 · <a href="https://sepolia.basescan.org/tx/${r.tx}" target="_blank">${short(r.tx, 8)}</a><br><span class="muted">리투오·역삼 I의원이라는 정보는 체인에 없음. 리뷰 티켓 1장 발급</span>`);
  },
  async scene2c() {
    await matchLocal();
    const ok = await claim('ofr_yeoksam_i_first_visit', 'cln_yeoksam_i');
    if (!ok) ev('local', '📱 같은 첫 방문 할인은 다시 받을 수 없음', '체인의 최신 해시에 역삼 I의원 방문이 들어 있어서, 옛날 차트로 증명해도 통과하지 않습니다');
  },
  scene3a() { document.querySelector('.tab[data-tab="rank"]').click(); },
  async scene3b() {
    // prefer the ticket from scene ② (Rituo @ Yeoksam I)
    const t = state.wallet.pendingReviews.find((x) => x.procedureId === 'rituo') ?? state.wallet.pendingReviews[0];
    if (!t) { ev('bad', '리뷰 티켓 없음', '② 장면의 "예약 → 시술 완료"를 먼저 실행하세요 (방문자만 리뷰 가능)'); return; }
    await reviewOnce(t.clinicId, t.procedureId, '아파… 그래도 3주 뒤 결이 매끈해졌어요.');
    await reviewOnce(t.clinicId, t.procedureId, '한 번 더 쓰면 별점 조작 가능?');
  },
  async scene4() {
    const w = state.wallet;
    const memo = w.selfReported.filter((r) => r.procedureId === 'rejuran_healer').length;
    const verified = w.verifiedRecords.filter((r) => r.procedureId === 'rejuran_healer').length;
    ev('local', '📱 리쥬란 기록 집계', `메모장(자기 신고) <b>${memo}건</b> · 병원 확인 <b>${verified}건</b><br><span class="muted">증명에 들어가는 건 병원 확인 기록뿐</span>`);
    await matchLocal(false);
    await claim('ofr_sinnonhyeon_d_rejuran_loyal', 'cln_sinnonhyeon_d');
  },
  async claimOffer(btn) { await claim(btn.dataset.offer, btn.dataset.clinic); },
};

async function reviewOnce(clinicId, procedureId, text) {
  try {
    const r = await api('/api/reviews', { persona, clinicId, procedureId, rating: 4, text });
    ev(r.ok ? 'ok' : 'bad', r.ok ? '✓ 익명 리뷰 등록 (Semaphore)' : '✗ 리뷰 거부', r.ok ? `${esc(clinicName(clinicId))} · "${esc(text)}"<br><span class="muted">누가 썼는지는 플랫폼도 모름 · 방문자임은 증명됨</span>` : esc(r.reason));
  } catch (e) { ev('bad', '✗ 리뷰 거부', `${esc(e.message)}<br><span class="muted">방문 1회 = 리뷰 1회. 같은 티켓으로 두 번 쓸 수 없음</span>`); }
}

// ---------------- events ----------------
document.addEventListener('click', async (e) => {
  const t = e.target.closest('button, .tab');
  if (!t) return;
  if (t.matches('.persona')) { state.match = null; await load(t.dataset.p); return; }
  if (t.matches('.tab')) {
    document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === t));
    $('#log').classList.toggle('hidden', t.dataset.tab !== 'log');
    $('#rank').classList.toggle('hidden', t.dataset.tab !== 'rank');
    return;
  }
  const act = t.dataset.act;
  if (!act && t.id !== 'visit-btn') return;
  t.disabled = true;
  try {
    if (t.dataset.persona && t.dataset.persona !== persona) await load(t.dataset.persona);
    if (t.id === 'visit-btn') await api('/api/records/visit', { persona, clinicId: $('#visit-clinic').value, procedureId: $('#visit-proc').value });
    else if (act === 'claim') await ACTIONS.claimOffer(t);
    else if (act === 'review') await reviewOnce(t.dataset.clinic, t.dataset.proc, $('#review-text').value);
    else await ACTIONS[act]();
  } catch (err) { ev('bad', 'error', esc(err.message)); }
  finally { t.disabled = false; const m = state.match; await load(); state.match = m; renderOffers(); }
});

// Calls made by other agents (e.g. the team's A2A agents) show up here too.
if (!params.has('nosse')) {
  new EventSource('/api/events').onmessage = (m) => {
    const e = JSON.parse(m.data);
    if (e.client === CLIENT) return;
    if (e.type === 'verify') ev(e.ok ? 'ok' : 'bad', `${e.ok ? '✓' : '✗'} [외부 에이전트] ${esc(e.clinic ?? e.clinicId)} 검증`, esc(e.reason));
    if (e.type === 'chain') ev('chain', `⛓ [외부] ${esc(e.clinic)} 기록 앵커`, `<a href="https://sepolia.basescan.org/tx/${e.tx}" target="_blank">${short(e.tx, 8)}</a>`);
  };
}
setInterval(async () => { try { const m = state.match; state = await api(`/api/state?persona=${persona}`); state.match = m; render(); } catch {} }, 20000);

await load();
// ?run=scene1 etc. auto-runs a read-only scene (handy for screenshots/rehearsal)
const run = params.get('run');
if (run && ['scene1', 'scene2a', 'scene2c', 'scene3a', 'scene4', 'match'].includes(run)) { await ACTIONS[run](); await load(); }
