/* 카탈로그 정적 검사 — 브라우저 없이 돌린다.
   프래그먼트 균형 · 참여자 참조 · 카드 커버리지 · 금지어(Kafka)를 본다.
   node tools/check-catalog.js                                            */
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

/* DOM 없이 sequences.js를 돌리기 위한 최소 스텁 — 렌더러는 쓰지 않는다 */
global.window = global;
global.document = {
  createElementNS: () => ({ setAttribute(){}, appendChild(){}, style:{},
                            getComputedTextLength: () => 0, set textContent(v){} }),
  body: { appendChild(){} }
};

require(path.join(root, "sequences.js"));
require(path.join(root, "seq-catalog.js"));
const S = global.PokeClipSequences;

/* ── 다이어그램별 카드 목록 — 각 문서의 소스에서 뽑는다 ── */
function read(f){ return fs.readFileSync(path.join(root, f), "utf8"); }

function idsFromBlock(src, startMark, endMark, re) {
  const i = src.indexOf(startMark), j = src.indexOf(endMark, i);
  const blk = src.slice(i, j);
  const out = [];
  let m; while ((m = re.exec(blk))) out.push(m[1]);
  return out;
}

const sys = read("04-system-architecture.html");
const SYS_CARDS = [
  ...idsFromBlock(sys, "const NODES = [", "\n];", /\{id:"([a-z0-9-]+)"/g),
  ...idsFromBlock(sys, "const SIDES = [", "\n];", /\{id:"([a-z0-9-]+)"/g)
];

const svc = read("03-service-architecture.html");
const SVC_CARDS = [
  ...idsFromBlock(svc, "const NODES = [", "\n];", /\{id:"([a-z0-9-]+)"/g),
  ...idsFromBlock(svc, "const SIDES = [", "\n];", /\{id:"([a-z0-9-]+)"/g)
];

const UC_CARDS = [];
for (let i = 1; i <= 32; i++) UC_CARDS.push("UC-" + String(i).padStart(2, "0"));

const ia = read("02-ia.html");
const IA_CARDS = idsFromBlock(ia, "const COLS = [", "\n];", /iaId:"([a-z0-9-]+)"/g);

const SETS = { system: SYS_CARDS, service: SVC_CARDS, usecase: UC_CARDS, ia: IA_CARDS };

/* ── 검사 ── */
let fail = 0;
const bad = (m) => { console.log("  ✗ " + m); fail++; };

console.log("시퀀스 " + S.all().length + "개");

/* 1. 프래그먼트 균형 · 참여자 참조 · 필수 필드 */
const REQ = ["title","trigger","purpose","participants","steps",
             "relatedUcIds","relatedIaNodeIds","relatedServiceIds","relatedComponentIds"];
for (const id of S.all()) {
  const s = S.get(id);
  for (const f of REQ) if (s[f] === undefined) bad(`${id}: 필드 없음 ${f}`);
  const known = new Set(s.participants.map(p => p.id));
  let depth = 0, opened = 0;
  s.steps.forEach((st, k) => {
    if (st.kind === "fragStart") { depth++; opened++; }
    else if (st.kind === "fragEnd") { depth--; if (depth < 0) bad(`${id}: step ${k} fragEnd 초과`); }
    else if (st.kind === "fragCase" || st.kind === "fragElse") {
      if (depth === 0) bad(`${id}: step ${k} ${st.kind} 이 프래그먼트 밖`);
    } else if (st.kind === "note") {
      if (!known.has(st.at)) bad(`${id}: step ${k} note at="${st.at}" 참여자 아님`);
      if (!st.text) bad(`${id}: step ${k} note 텍스트 없음`);
    } else if (st.kind === "self") {
      if (!known.has(st.from)) bad(`${id}: step ${k} self from="${st.from}" 참여자 아님`);
    } else if (["sync","async","reply","store"].includes(st.kind)) {
      if (!known.has(st.from)) bad(`${id}: step ${k} from="${st.from}" 참여자 아님`);
      if (!known.has(st.to))   bad(`${id}: step ${k} to="${st.to}" 참여자 아님`);
    } else bad(`${id}: step ${k} 알 수 없는 kind "${st.kind}"`);
  });
  if (depth !== 0) bad(`${id}: 프래그먼트 미종료 ${depth}개`);
  if (!opened) { /* 프래그먼트 없는 시퀀스도 허용 */ }
  /* 참여자가 한 번도 안 쓰이면 열만 차지한다 */
  const used = new Set();
  s.steps.forEach(st => { if (st.from) used.add(st.from); if (st.to) used.add(st.to); if (st.at) used.add(st.at); });
  for (const p of s.participants) if (!used.has(p.id)) bad(`${id}: 참여자 "${p.id}" 가 한 번도 안 쓰임`);
  if (s.participants.length > 7) bad(`${id}: 참여자 ${s.participants.length}명 — 7명 초과`);
}

/* 2. 카드 커버리지 */
for (const [d, cards] of Object.entries(SETS)) {
  if (!cards.length) { bad(`${d}: 카드 목록을 못 읽었다`); continue; }
  const miss = cards.filter(c => S.idsFor(d, c).length === 0);
  const ghost = S.coveredCards(d).filter(c => !cards.includes(c));
  console.log(`  ${d}: 카드 ${cards.length}개 · 누락 ${miss.length} · 유령 ${ghost.length}`);
  if (miss.length) bad(`${d} 누락: ${miss.join(", ")}`);
  if (ghost.length) bad(`${d} 없는 카드를 가리킴: ${ghost.join(", ")}`);
}

/* 3. Kafka(별도 이벤트 버스)가 어디에도 새어들지 않았는가 — 초기 구성엔 없다 */
for (const id of S.all()) {
  const s = S.get(id);
  const hit = s.participants.some(p => p.id === "kafka") ||
              s.steps.some(st => /kafka/i.test(st.text || "")) ||
              (s.notes || []).some(t => /kafka/i.test(t) && !/없다|아니다|않는다|밖/.test(t));
  if (hit) bad(`${id}: Kafka가 등장한다 — 별도 이벤트 버스는 쓰지 않는다`);
}

/* 4. ④의 카드는 실행 단위·저장소와 1:1이다 — 가리킨 카드가 실제로 그 시퀀스에
      생명선으로 등장해야 한다. 안 그러면 "눌렀는데 내가 안 나오는" 목록이 된다. */
const NODE2ACTOR = {
  media:["media"], chat:["chat","chatA","chatB"], detect:["detect"], redis:["redis"],
  core:["core"], gate:["gate"], "w-sub":["wsub"], "w-prev":["wprev"],
  "w-render":["wrender"], "w-upload":["wupload"], pg:["pg"], sqs:["sqs"], s3:["s3"],
  plugin:["plugin"], web:["web"], cdn:["cdn"],
  "ex-chat":["plat"], "ex-google":["google"], "ex-yt":["yt"], "ex-pg":["pay"]
};
for (const id of S.all()) {
  const s = S.get(id);
  const have = new Set(s.participants.map(p => p.id));
  for (const cid of s.relatedComponentIds || []) {
    const want = NODE2ACTOR[cid];
    if (!want) { bad(`${id}: ④에 없는 카드 "${cid}"`); continue; }
    if (!want.some(a => have.has(a))) bad(`${id}: "${cid}" 를 가리키는데 생명선에 없다`);
  }
}

/* 5. SQS 큐 이름이 확정된 다섯 개 안인가 */
const QUEUES = ["vod-finalize", "subtitle", "preview", "render", "upload"];
for (const id of S.all()) {
  for (const st of S.get(id).steps) {
    const m = /([a-z-]+)-jobs?\b/.exec(st.text || "");
    if (m && !QUEUES.includes(m[1])) bad(`${id}: 확정되지 않은 큐 이름 "${m[1]}"`);
  }
}

console.log(fail ? `\n실패 ${fail}건` : "\n전부 통과");
process.exit(fail ? 1 : 0);
