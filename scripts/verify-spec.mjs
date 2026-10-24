#!/usr/bin/env node
// Verifies the docs/spec set: structure, Agent Card examples, JSON blocks,
// skill id consistency, style bans, relative links, and compliance URL provenance.
// Usage: node scripts/verify-spec.mjs <structure|agentcards|json|skills|style|urls|all>
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const specDir = join(root, "docs", "spec");
const read = (p) => readFileSync(p, "utf8");

const REQUIRED = {
  "00-overview.md": ["한 줄 정의", "세 개의 축", "핵심 원칙", "범위", "용어"],
  "01-users-journeys.md": ["페르소나", "고객 여정", "병원 여정", "운영자 여정"],
  "02-agents.md": ["고객 에이전트", "플랫폼 에이전트", "병원 에이전트", "정보 경계"],
  "03-a2a-protocol.md": ["바인딩과 엔드포인트", "스킬 라우팅 규칙", "태스크 상태 매핑", "Agent Card 예시", "메시지 스키마", "전체 시퀀스", "인증과 신뢰", "대행 운영"],
  "04-onboarding-chat.md": ["공통 설계", "고객 온보딩", "병원 온보딩"],
  "05-screens.md": ["UI 규칙", "고객 웹앱", "병원 콘솔", "운영 콘솔", "데모 컨트롤"],
  "06-data-model.md": ["저장소 구조", "고객 네임스페이스", "플랫폼 네임스페이스", "병원 네임스페이스", "시드 파일"],
  "07-platform-intelligence.md": ["가격·용량 판정", "병원 추천", "결과 수집", "연결 규칙과 개선 루프"],
  "08-compliance.md": ["외국인환자 유치사업자", "고객 자격", "광고 규제", "부가세 환급", "개인정보", "의료 경계"],
  "09-architecture.md": ["스택과 버전", "디렉토리", "모듈 경계", "A2A 서버 연결", "SDK 함정", "LLM 사용"],
  "10-build-plan.md": ["작업 규칙", "태스크 순서", "데모 시나리오", "미결"],
};

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

// Fenced code blocks with their language tag.
function codeBlocks(md) {
  const out = [];
  const re = /^```([\w-]*)[^\n]*\n([\s\S]*?)^```\s*$/gm;
  let m;
  while ((m = re.exec(md))) out.push({ lang: m[1], body: m[2] });
  return out;
}

const jsonBlocks = (md) => codeBlocks(md).filter((b) => b.lang === "json");

function tryParse(body) {
  try {
    return { ok: true, value: JSON.parse(body) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const specFiles = () => readdirSync(specDir).filter((f) => f.endsWith(".md")).sort();

function checkStructure() {
  for (const [file, headings] of Object.entries(REQUIRED)) {
    const p = join(specDir, file);
    if (!existsSync(p)) fail(`missing ${file}`);
    const heads = read(p).split("\n").filter((l) => /^#{1,4} /.test(l));
    for (const h of headings) {
      if (!heads.some((l) => l.includes(h))) fail(`${file} lacks heading containing "${h}"`);
    }
  }
  console.log(`checked ${Object.keys(REQUIRED).length} files`);
  console.log("structure verification passed");
}

const CARD_REQUIRED = ["name", "description", "supportedInterfaces", "version", "capabilities", "defaultInputModes", "defaultOutputModes", "skills"];
const SKILL_REQUIRED = ["id", "name", "description", "tags"];

function cardsFrom03() {
  return jsonBlocks(read(join(specDir, "03-a2a-protocol.md")))
    .map((b) => tryParse(b.body))
    .filter((r) => r.ok && r.value && r.value.supportedInterfaces)
    .map((r) => r.value);
}

function validateCard(card) {
  const errs = [];
  for (const k of CARD_REQUIRED) if (!(k in card)) errs.push(`card ${card.name ?? "?"} missing ${k}`);
  for (const i of card.supportedInterfaces ?? []) {
    for (const k of ["url", "protocolBinding", "protocolVersion"]) if (!i[k]) errs.push(`interface missing ${k}`);
    if (i.protocolVersion !== "1.0") errs.push(`interface protocolVersion ${i.protocolVersion} != 1.0`);
  }
  for (const s of card.skills ?? []) {
    for (const k of SKILL_REQUIRED) if (!(k in s)) errs.push(`skill ${s.id ?? "?"} missing ${k}`);
    if (!Array.isArray(s.tags) || s.tags.length === 0) errs.push(`skill ${s.id} has empty tags`);
  }
  return errs;
}

function checkAgentCards() {
  // Positive control: a card missing required fields must be rejected.
  const control = validateCard({ name: "x", supportedInterfaces: [{ url: "u", protocolBinding: "JSONRPC", protocolVersion: "0.3" }], skills: [{ id: "a" }] });
  if (control.length === 0) fail("positive control: invalid card was accepted");
  const cards = cardsFrom03();
  if (cards.length !== 3) fail(`expected 3 Agent Cards in 03-a2a-protocol.md, found ${cards.length}`);
  for (const c of cards) {
    const errs = validateCard(c);
    if (errs.length) fail(errs.join("; "));
  }
  console.log(`cards: ${cards.map((c) => c.name).join(" | ")}`);
  console.log("agentcard verification passed");
}

function checkJson() {
  if (tryParse('{"a": 1,}').ok || tryParse("{bad").ok) fail("positive control: broken JSON was accepted");
  let n = 0;
  for (const f of specFiles()) {
    for (const b of jsonBlocks(read(join(specDir, f)))) {
      n++;
      const r = tryParse(b.body);
      if (!r.ok) fail(`${f}: JSON block ${n} does not parse: ${r.error}`);
    }
  }
  if (n === 0) fail("no JSON blocks found");
  console.log(`parsed ${n} JSON blocks`);
  console.log("json verification passed");
}

const SKILL_RE = /`((?:customer|platform|clinic)\.[a-z_]+)`/g;
const setOf = (text) => new Set([...text.matchAll(SKILL_RE)].map((m) => m[1]));
const diff = (a, b) => [...a].filter((x) => !b.has(x));

function checkSkills() {
  const agents = setOf(read(join(specDir, "02-agents.md")));
  const cardIds = new Set(cardsFrom03().flatMap((c) => c.skills.map((s) => s.id)));
  const md03 = read(join(specDir, "03-a2a-protocol.md"));
  const routingIds = setOf(md03.slice(md03.indexOf("## 스킬 라우팅 규칙"), md03.indexOf("## 응답 형태 규칙")));
  const pairs = [
    ["02-agents", agents, "agent cards", cardIds],
    ["agent cards", cardIds, "02-agents", agents],
    ["routing table", routingIds, "agent cards", cardIds],
    ["agent cards", cardIds, "routing table", routingIds],
  ];
  for (const [an, a, bn, b] of pairs) {
    const d = diff(a, b);
    if (d.length) fail(`in ${an} but not ${bn}: ${d.join(", ")}`);
  }
  if (cardIds.size < 10) fail(`suspiciously few skills: ${cardIds.size}`);
  console.log(`skills (${cardIds.size}): ${[...cardIds].sort().join(", ")}`);
  console.log("skill consistency verification passed");
}

// Banned characters are built from code points so this file itself stays clean.
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const BANNED = [
  [new RegExp(EM, "u"), "em dash"],
  [new RegExp(EN, "u"), "en dash"],
  [/\p{Extended_Pictographic}/u, "emoji/pictograph"],
];

function styleHits(text) {
  const hits = [];
  text.split("\n").forEach((line, i) => {
    for (const [re, name] of BANNED) if (re.test(line)) hits.push(`${name} at line ${i + 1}`);
  });
  return hits;
}

function linkHits(file, text) {
  const hits = [];
  const re = /\]\(([^)\s]+)\)/g;
  let m;
  while ((m = re.exec(text))) {
    const target = m[1];
    if (/^(https?:|mailto:|#)/.test(target)) continue;
    const path = decodeURIComponent(target.split("#")[0]);
    if (!existsSync(resolve(dirname(file), path))) hits.push(`broken link ${target}`);
  }
  return hits;
}

const ownedDocs = () => [
  ...specFiles().map((f) => join(specDir, f)),
  join(root, "docs", "research", "regulatory-market.md"),
  join(root, "README.md"),
  join(root, "CLAUDE.md"),
];

function checkStyle() {
  const smile = String.fromCodePoint(0x1f600);
  if (styleHits(`a${EM}b`).length === 0 || styleHits(`a${EN}b`).length === 0 || styleHits(`ok ${smile}`).length === 0) {
    fail("positive control: banned character not detected");
  }
  if (linkHits(join(specDir, "x.md"), "[a](does-not-exist.md)").length === 0) fail("positive control: broken link not detected");
  const problems = [];
  for (const f of ownedDocs()) {
    const text = read(f);
    for (const h of [...styleHits(text), ...linkHits(f, text)]) problems.push(`${f.replace(root + "/", "")}: ${h}`);
  }
  if (problems.length) fail(problems.join("\n"));
  console.log(`scanned ${ownedDocs().length} files`);
  console.log("style verification passed");
}

const URL_RE = /https?:\/\/[^\s)>|`]+/g;
const urlsIn = (text) => [...new Set((text.match(URL_RE) ?? []).map((u) => u.replace(/[.,]$/, "")))];

function checkUrls() {
  const known = new Set(urlsIn(read(join(root, "docs", "research", "regulatory-market.md"))));
  const used = urlsIn(read(join(specDir, "08-compliance.md")));
  if (used.length < 10) fail(`expected at least 10 cited URLs in 08-compliance.md, found ${used.length}`);
  const unknown = used.filter((u) => !known.has(u));
  if (unknown.length) fail(`URLs in 08-compliance.md not in research doc:\n${unknown.join("\n")}`);
  console.log(`cited ${used.length} URLs, all present in research doc`);
  console.log("url provenance verification passed");
}

const modes = { structure: checkStructure, agentcards: checkAgentCards, json: checkJson, skills: checkSkills, style: checkStyle, urls: checkUrls };
const mode = process.argv[2];
if (mode === "all") for (const fn of Object.values(modes)) fn();
else if (modes[mode]) modes[mode]();
else fail(`unknown mode ${mode}; use one of ${Object.keys(modes).join(", ")}, all`);
