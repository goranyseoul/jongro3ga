const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const short = (h, n = 6) => (h && h.length > 2 * n + 2 ? `${h.slice(0, n + 2)}…${h.slice(-n)}` : h);
const time = (t) => new Date(t).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const COLORS = ['#c8406f', '#4b3fb3', '#1d7f57', '#c27a12', '#2a7bb8', '#8a4fb0'];

let ledger = [], personas = [], deployment = null;
const params = new URLSearchParams(location.search);
let persona = params.get('persona') ?? 'yuki', wallet = null, selectedTx = null;
const subjectColor = new Map();
const colorOf = (s) => { if (!subjectColor.has(s)) subjectColor.set(s, COLORS[subjectColor.size % COLORS.length]); return subjectColor.get(s); };

async function load() {
  const [l, w] = await Promise.all([fetch('/api/ledger').then((r) => r.json()), fetch(`/api/wallet/${persona}`).then((r) => r.json())]);
  ({ ledger, personas, deployment } = l);
  wallet = w;
  // ?select=mine preselects this persona's latest record (handy for slides)
  if (!selectedTx && params.get('select') === 'mine') selectedTx = wallet.records.at(-1)?.tx ?? null;
  if (!selectedTx && params.get('tx')) selectedTx = params.get('tx');
  render();
}

function render() {
  $('#contract').innerHTML = `RecordRegistry <a target="_blank" href="https://sepolia.basescan.org/address/${deployment.registry}#events">${short(deployment.registry, 6)}</a> · 데모 시계 1일 = ${deployment.secondsPerDay}초`;
  $('#count').textContent = `이벤트 ${ledger.length}건 · 실시간`;
  const mine = new Set(wallet.records.map((r) => r.tx));
  $('#rows').innerHTML = ledger.map((e) => `<tr data-tx="${e.tx}" class="${mine.has(e.tx) ? 'mine' : ''} ${e.tx === selectedTx ? 'sel' : ''}">
      <td>${time(e.timestamp)}</td>
      <td><span class="dot" style="background:${colorOf(e.subjectId)}"></span>${short(e.subjectId, 4)}</td>
      <td>${short(e.commitment, 6)}</td>
      <td>v${e.version}</td>
      <td><a target="_blank" href="https://sepolia.basescan.org/tx/${e.tx}" onclick="event.stopPropagation()">${short(e.tx, 4)}</a></td></tr>`).join('');
  renderDetail();
  renderPhone();
}

function renderDetail() {
  const e = ledger.find((x) => x.tx === selectedTx);
  if (!e) return;
  $('#detail').innerHTML = `<div class="kv">
      <span>함수</span><span>append(subjectId, newCommitment, recordHash, day, proof)</span>
      <span>subjectId</span><span>${e.subjectId}</span>
      <span>새 차트 해시</span><span>${e.commitment}</span>
      <span>버전</span><span>v${e.version} (이 가명의 ${e.version}번째 기록)</span>
      <span>day</span><span>${e.day} (컨트랙트가 블록 시간과 대조 → 소급 불가)</span>
      <span>proof</span><span>약 8.4KB · 컨트랙트가 온체인 검증 통과</span>
      <span>시술 종류</span><span class="unk">기록되지 않음</span>
      <span>병원</span><span class="unk">기록되지 않음 (플랫폼 relayer가 대신 제출)</span>
      <span>환자 이름·국적</span><span class="unk">기록되지 않음</span></div>`;
}

function renderPhone() {
  const p = wallet.profile;
  const sel = ledger.find((x) => x.tx === selectedTx);
  const isMine = !sel || wallet.records.some((r) => r.tx === selectedTx);
  const head = `<div class="who"><div><div class="nm">📱 ${p.flag} ${esc(p.name)}의 폰</div><div class="muted" style="font-size:12px">차트 원본 · 이 기기에만 저장</div></div>
    <div class="pchips">${personas.map((x) => `<button class="pchip ${x.id === persona ? 'on' : ''}" data-p="${x.id}">${x.flag}</button>`).join('')}</div></div>`;
  if (!isMine) {
    $('#phone').innerHTML = head + `<div class="locked"><div class="big">🔒</div>선택한 줄은 <b>다른 사람의 기록</b>입니다.<br>${esc(p.name)}의 폰도 이 해시가 무슨 시술인지 알 수 없습니다.<br><span class="muted">차트 원본과 salt를 가진 본인 기기만 해석 가능</span></div>`;
    return;
  }
  const recs = wallet.records.length
    ? [...wallet.records].reverse().map((r) => `<div class="rec ${r.tx === selectedTx ? 'sel' : ''}">
        <div class="rtop"><span>${esc(r.name)}</span><span class="ago">${r.daysAgo}일 전</span></div>
        <div class="meta">${esc(r.clinic)} · 병원 서명 기록</div>
        <div class="link">↔ 공개 원장 tx ${short(r.tx, 4)}</div></div>`).join('')
    : '<div class="locked">아직 기록이 없습니다</div>';
  $('#phone').innerHTML = head + recs + `<div class="explain" style="margin-top:10px">공개 원장의 같은 줄에는 "${esc(wallet.onchain.subjectId.slice(0, 8))}… 의 해시가 바뀌었다"는 사실만 있습니다.</div>`;
}

document.addEventListener('click', async (ev) => {
  const row = ev.target.closest('tr[data-tx]');
  if (row) { selectedTx = row.dataset.tx; render(); }
  const chip = ev.target.closest('.pchip');
  if (chip) { persona = chip.dataset.p; selectedTx = null; $('#detail').innerHTML = '<span class="muted">줄을 클릭하면 이 트랜잭션에서 공개된 전부를 보여줍니다.</span>'; await load(); }
});
load();
setInterval(load, 20000);
