/* ============================================================================
   PokeClip — 시퀀스 엔진 (참여자 사전 · SVG 렌더러 · 카드 역인덱스)
   ----------------------------------------------------------------------------
   역할 분리
   · sequences.js   이 파일. 데이터는 모른다. 참여자 이름 · 렌더러 · 조회 API.
   · seq-catalog.js 시퀀스 "내용"이 있는 유일한 곳. define()으로 등록한다.
   · seq-ui.js      카드 클릭 → 목록(Drawer) → 상세(Overlay). 네 문서 공용.

   카드 → 시퀀스 매핑은 손으로 적지 않는다.
   시퀀스가 스스로 "나는 어느 카드에 걸리는가"를 relatedXxxIds 로 밝히고,
   여기서 역인덱스를 만든다. 그래서 같은 흐름이 카드마다 복제되지 않는다.

   근거가 된 확정 문서 (2026-07-24 기준)
   · ④ 시스템 아키텍처 v2.8 — 별도 이벤트 버스 없음. 팬아웃은 Redis Pub/Sub,
     실시간 집계는 Redis, 작업 큐는 SQS+DLQ 다섯 개(vod-finalize · subtitle ·
     preview · render · upload). Redis 는 Source of Truth 가 아니다.
   · ③ 서비스 아키텍처 v2.2 — 논리 Capability 21 + 접점·외부 8.
   · ① 유스케이스 v3.9 — UC-01~32.
   · ② IA v3.3 — 표면·글로벌 메뉴·화면.
   · ADR-004·005·006·010·011·012·013·015 — 채택된 팀 결정.
   · 부록 A 장애 시나리오 · 부록 B 추적성 · 부록 C 상태 머신.
============================================================================ */
(function (global) {
"use strict";

/* ── 참여자 이름은 모든 시퀀스에서 동일하게 쓴다 ─────────────────────────
   kind 는 머리 상자의 모양만 정한다. 이름이 같으면 같은 것이다.          */
var ACTORS = {
  /* 사람 */
  streamer: { name: "스트리머",        kind: "human"    },
  editor:   { name: "편집자",          kind: "human"    },
  /* 클라이언트 */
  web:      { name: "웹 앱",           kind: "client"   },
  plugin:   { name: "OBS 플러그인",     kind: "client"   },
  cdn:      { name: "재생 딜리버리",    kind: "edge"     },
  /* 실행 단위 (④) */
  core:     { name: "Core API",        kind: "service"  },
  gate:     { name: "업로드 권한 Gate", kind: "service"  },
  media:    { name: "미디어 서버",      kind: "service"  },
  chat:     { name: "채팅 수집기",      kind: "service"  },
  chatA:    { name: "채팅 수집기 A",    kind: "service"  },
  chatB:    { name: "채팅 수집기 B",    kind: "service"  },
  detect:   { name: "하이라이트 감지기", kind: "service" },
  wsub:     { name: "자막 워커",        kind: "service"  },
  wprev:    { name: "미리보기 워커",     kind: "service"  },
  wrender:  { name: "렌더 워커",        kind: "service"  },
  wupload:  { name: "업로드 워커",      kind: "service"  },
  /* 저장소 · 큐 */
  pg:       { name: "PostgreSQL",      kind: "store"    },
  redis:    { name: "Redis",           kind: "store"    },
  s3:       { name: "S3",              kind: "store"    },
  sqs:      { name: "SQS + DLQ",       kind: "queue"    },
  /* 외부 */
  plat:     { name: "치지직 / SOOP",    kind: "external" },
  yt:       { name: "YouTube",         kind: "external" },
  google:   { name: "Google",          kind: "external" },
  pay:      { name: "결제 시스템",      kind: "external" },
  /* 운영 */
  ops:      { name: "모니터링",         kind: "ops"      },
  console:  { name: "운영자 콘솔",      kind: "ops"      }
};

var KIND_LABEL = {
  human: "행위자", client: "클라이언트", edge: "딜리버리", service: "서비스",
  store: "저장소", queue: "큐", external: "외부", ops: "운영"
};

/* 참여자 목록을 만든다. 없는 id 는 즉시 드러나게 던진다(조용한 누락 금지). */
function P(ids) {
  return ids.map(function (id) {
    var a = ACTORS[id];
    if (!a) throw new Error("[sequences] 알 수 없는 참여자: " + id);
    return { id: id, name: a.name, kind: a.kind };
  });
}

/* ── 카탈로그 ────────────────────────────────────────────────────────────
   step 종류
     sync  동기 호출        ──▶  (채운 화살촉)
     async 비동기 전달      ──▷  (열린 화살촉)
     reply 응답             --▷  (파선 + 열린 화살촉)
     store 저장 · 조회 · 발행 ──■ (사각 종단)
     self  자기 처리        ↻    (자기 생명선 오른쪽 고리)
     note  설명 상자        (선 위에 얹지 않고 별도 행을 차지한다)
   프래그먼트: fragStart(type,label) / fragCase(label) / fragElse(label) / fragEnd
                                                                          */
var CATALOG = {};
var ORDER = [];
var _index = null;                       /* 역인덱스 캐시 */

/* 시퀀스 등록. seq-catalog.js 가 여러 번 나눠 부를 수 있다. */
function define(map) {
  for (var id in map) {
    if (!Object.prototype.hasOwnProperty.call(map, id)) continue;
    if (!CATALOG[id]) ORDER.push(id);
    map[id].id = id;
    CATALOG[id] = map[id];
  }
  _index = null;
  return API;
}

/* 다이어그램별로 "카드 id 가 어느 필드에 적히는가" */
var FIELD = {
  system:  "relatedComponentIds",   /* ④ 실행 단위 · 저장소 · 접점 · 외부 */
  service: "relatedServiceIds",     /* ③ 논리 Capability · 접점 · 외부 */
  usecase: "relatedUcIds",          /* ① UC-01 ~ UC-32 */
  ia:      "relatedIaNodeIds"       /* ② 표면 · 화면 */
};

function buildIndex() {
  var ix = { system: {}, service: {}, usecase: {}, ia: {} };
  for (var d in FIELD) {
    var f = FIELD[d];
    for (var i = 0; i < ORDER.length; i++) {
      var s = CATALOG[ORDER[i]], list = s[f];
      if (!list) continue;
      for (var k = 0; k < list.length; k++) {
        (ix[d][list[k]] || (ix[d][list[k]] = [])).push(s.id);
      }
    }
  }
  return ix;
}

/* 카드 하나에 걸린 시퀀스 id 목록. 카탈로그 선언 순서를 그대로 쓴다. */
function idsFor(diagram, cardId) {
  if (!FIELD[diagram]) return [];
  if (!_index) _index = buildIndex();
  var got = _index[diagram][cardId];
  return got ? got.slice() : [];
}

/* 검증용 — 이 다이어그램에서 시퀀스가 붙은 카드 id 전부 */
function coveredCards(diagram) {
  if (!FIELD[diagram]) return [];
  if (!_index) _index = buildIndex();
  return Object.keys(_index[diagram]);
}

/* ========================================================================
   렌더러 — 데이터를 SVG 시퀀스 다이어그램으로 그린다.
   시간은 위에서 아래로 흐른다. 참여자 열 너비는 실제 글자 폭으로 정한다.
======================================================================== */
var NS = "http://www.w3.org/2000/svg";

var LAY = {
  padX: 28, padTop: 16, padBottom: 26,
  headH: 46, headGap: 26,
  rowH: 34,
  minCol: 128, gapBase: 56,
  selfW: 26, selfH: 20,
  fragPadTop: 22, fragPadBottom: 12, fragInset: 14,
  labelGap: 7, msgFont: 11.5, headFont: 12.5, noteFont: 11,
  noteLine: 15, noteMaxW: 460
};

/* 글자 폭 측정 — 화면 밖 SVG에 실제로 그려서 잰다(폰트 그대로 반영) */
var _mSvg = null, _mText = null;
function measure(text, size, weight) {
  if (!_mSvg) {
    _mSvg = document.createElementNS(NS, "svg");
    _mSvg.setAttribute("width", "0"); _mSvg.setAttribute("height", "0");
    _mSvg.style.cssText = "position:absolute;left:-9999px;top:-9999px;overflow:hidden";
    _mText = document.createElementNS(NS, "text");
    _mSvg.appendChild(_mText); document.body.appendChild(_mSvg);
  }
  _mText.setAttribute("font-size", size);
  _mText.setAttribute("font-weight", weight || "400");
  _mText.textContent = text;
  return _mText.getComputedTextLength();
}

/* 긴 설명을 폭에 맞춰 줄바꿈 */
function wrap(text, maxW, size) {
  var words = String(text).split(/\s+/), lines = [], cur = "";
  for (var i = 0; i < words.length; i++) {
    var t = cur ? cur + " " + words[i] : words[i];
    if (cur && measure(t, size) > maxW) { lines.push(cur); cur = words[i]; }
    else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

function el(tag, attrs, parent) {
  var n = document.createElementNS(NS, tag);
  for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

/* 참여자 x 좌표 — 모든 메시지 라벨이 자기 구간 안에 들어가도록 열 간격을 넓힌다 */
function layoutColumns(seq) {
  var ps = seq.participants, n = ps.length;
  var headW = ps.map(function (p) {
    return Math.max(LAY.minCol, measure(p.name, LAY.headFont, "700") + 26);
  });
  var gaps = []; for (var i = 0; i < n - 1; i++) gaps.push(LAY.gapBase);

  function xs() {
    var out = [], acc = LAY.padX + headW[0] / 2;
    out.push(acc);
    for (var i = 1; i < n; i++) { acc += headW[i - 1] / 2 + gaps[i - 1] + headW[i] / 2; out.push(acc); }
    return out;
  }
  var idx = {}; ps.forEach(function (p, i) { idx[p.id] = i; });

  for (var pass = 0; pass < 6; pass++) {
    var x = xs(), changed = false;
    for (var s = 0; s < seq.steps.length; s++) {
      var st = seq.steps[s];
      if (st.kind === "note" || st.kind === "self" || String(st.kind).indexOf("frag") === 0) continue;
      var a = idx[st.from], b = idx[st.to];
      if (a === undefined || b === undefined || a === b) continue;
      var lo = Math.min(a, b), hi = Math.max(a, b);
      var need = measure(st.text, LAY.msgFont, "600") + 22;
      var have = Math.abs(x[hi] - x[lo]);
      if (have < need) {
        var add = (need - have) / (hi - lo);
        for (var g = lo; g < hi; g++) gaps[g] += add;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { x: xs(), headW: headW, idx: idx };
}

/* 시퀀스 하나를 SVG로 렌더 */
function renderSequence(seq) {
  var col = layoutColumns(seq);
  var n = seq.participants.length;
  var svg = el("svg", { "class": "seqsvg", xmlns: NS });
  var defs = el("defs", {}, svg);

  var m1 = el("marker", { id: "sq-solid", markerWidth: "10", markerHeight: "10", refX: "8.5",
    refY: "4", orient: "auto", markerUnits: "userSpaceOnUse" }, defs);
  el("path", { d: "M0,0.6 L8.5,4 L0,7.4 Z", "class": "sq-head-solid" }, m1);
  var m2 = el("marker", { id: "sq-open", markerWidth: "10", markerHeight: "10", refX: "8.5",
    refY: "4", orient: "auto", markerUnits: "userSpaceOnUse" }, defs);
  el("path", { d: "M0.8,0.6 L8.5,4 L0.8,7.4", "class": "sq-head-open" }, m2);
  var m3 = el("marker", { id: "sq-store", markerWidth: "9", markerHeight: "9", refX: "7",
    refY: "4.5", orient: "auto", markerUnits: "userSpaceOnUse" }, defs);
  el("rect", { x: "2.6", y: "1.6", width: "5.8", height: "5.8", "class": "sq-head-solid" }, m3);

  var gLife = el("g", { "class": "sq-life" }, svg);
  var gFrag = el("g", { "class": "sq-frags" }, svg);
  var gMsg  = el("g", { "class": "sq-msgs" }, svg);
  var gHead = el("g", { "class": "sq-heads" }, svg);

  var y = LAY.padTop + LAY.headH + LAY.headGap;
  var fragStack = [];
  var maxRight = 0;

  /* 프래그먼트 상자는 안에 들어간 것들의 "실제 픽셀 범위"로 잡는다.
     열 인덱스로만 잡으면 설명 상자나 자기 처리 라벨이 상자 밖으로 삐져나온다. */
  function expand(x0, x1) {
    for (var k = 0; k < fragStack.length; k++) {
      if (x0 < fragStack[k].xmin) fragStack[k].xmin = x0;
      if (x1 > fragStack[k].xmax) fragStack[k].xmax = x1;
    }
  }

  for (var i = 0; i < seq.steps.length; i++) {
    var st = seq.steps[i];

    /* ── 프래그먼트 ── */
    if (st.kind === "fragStart") {
      fragStack.push({ type: st.type, label: st.label, y0: y,
                       xmin: Infinity, xmax: -Infinity, cases: [] });
      y += LAY.fragPadTop;
      continue;
    }
    if (st.kind === "fragCase" || st.kind === "fragElse") {
      var f = fragStack[fragStack.length - 1];
      if (f) { f.cases.push({ y: y, label: st.label, first: st.kind === "fragCase" }); y += 18; }
      continue;
    }
    if (st.kind === "fragEnd") {
      var fr = fragStack.pop();
      if (fr) {
        y += LAY.fragPadBottom;
        if (fr.xmin === Infinity) { fr.xmin = col.x[0]; fr.xmax = col.x[n - 1]; }
        var x0 = fr.xmin - LAY.fragInset;
        var x1 = fr.xmax + LAY.fragInset;
        el("rect", { x: x0, y: fr.y0, width: x1 - x0, height: y - fr.y0,
                     "class": "sq-frag", rx: 3 }, gFrag);
        var tw = measure(fr.type, 10, "700") + 14;
        el("path", { d: "M" + x0 + " " + fr.y0 + " h" + (tw + 8) + " l-8 15 h-" + tw + " Z",
                     "class": "sq-fragtab" }, gFrag);
        el("text", { x: x0 + 6, y: fr.y0 + 11.5, "class": "sq-fragtype" }, gFrag).textContent = fr.type;
        for (var c = 0; c < fr.cases.length; c++) {
          var cs = fr.cases[c];
          if (c > 0) el("line", { x1: x0, y1: cs.y - 4, x2: x1, y2: cs.y - 4, "class": "sq-fragsplit" }, gFrag);
          el("text", { x: x0 + (c === 0 ? tw + 16 : 10), y: cs.y + 8, "class": "sq-fragcase" }, gFrag)
            .textContent = "[" + cs.label + "]";
        }
        expand(x0 - 4, x1 + 4);          /* 바깥 프래그먼트가 이 상자를 감싸게 */
        maxRight = Math.max(maxRight, x1);
      }
      continue;
    }

    /* ── 설명 상자 ── */
    if (st.kind === "note") {
      var ai = col.idx[st.at] !== undefined ? col.idx[st.at] : 0;
      var lines = wrap(st.text, LAY.noteMaxW, LAY.noteFont);
      var w = 0; lines.forEach(function (l) { w = Math.max(w, measure(l, LAY.noteFont)); });
      w += 20;
      var h = lines.length * LAY.noteLine + 12;
      var nx = Math.min(Math.max(col.x[ai] - w / 2, LAY.padX), col.x[n - 1] + col.headW[n - 1] / 2 - w);
      if (nx < LAY.padX) nx = LAY.padX;
      el("rect", { x: nx, y: y, width: w, height: h, "class": "sq-note", rx: 2 }, gMsg);
      for (var li = 0; li < lines.length; li++) {
        el("text", { x: nx + 10, y: y + 15 + li * LAY.noteLine, "class": "sq-notetext" }, gMsg)
          .textContent = lines[li];
      }
      y += h + 10;
      maxRight = Math.max(maxRight, nx + w);
      expand(nx, nx + w);
      continue;
    }

    /* ── 자기 처리 ── */
    if (st.kind === "self") {
      var si = col.idx[st.from];
      if (si === undefined) continue;
      var sx = col.x[si];
      var yy = y + 6;
      el("path", { d: "M" + sx + " " + yy + " h" + LAY.selfW + " v" + LAY.selfH +
                      " h-" + LAY.selfW, "class": "sq-line sq-self",
                   "marker-end": "url(#sq-open)" }, gMsg);
      var tx = sx + LAY.selfW + 9;
      el("text", { x: tx, y: yy + LAY.selfH - 3, "class": "sq-msgtext sq-msgtext-left" }, gMsg)
        .textContent = st.text;
      var selfR = tx + measure(st.text, LAY.msgFont, "600");
      maxRight = Math.max(maxRight, selfR);
      expand(sx - 6, selfR);
      y += LAY.selfH + 16;
      continue;
    }

    /* ── 참여자 사이 메시지 ── */
    var a = col.idx[st.from], b = col.idx[st.to];
    if (a === undefined || b === undefined) continue;
    var xa = col.x[a], xb = col.x[b];
    var dir = xb > xa ? 1 : -1;
    var head = st.kind === "store" ? "url(#sq-store)"
             : st.kind === "sync"  ? "url(#sq-solid)" : "url(#sq-open)";
    var cls = "sq-line" + (st.kind === "reply" ? " sq-dash" : "");
    el("line", { x1: xa + dir * 2, y1: y + 16, x2: xb - dir * 3, y2: y + 16,
                 "class": cls, "marker-end": head }, gMsg);
    el("text", { x: (xa + xb) / 2, y: y + 16 - LAY.labelGap, "class": "sq-msgtext" }, gMsg)
      .textContent = st.text;
    y += LAY.rowH;
    var lw = measure(st.text, LAY.msgFont, "600") / 2, mid = (xa + xb) / 2;
    var mLo = Math.min(Math.min(xa, xb), mid - lw), mHi = Math.max(Math.max(xa, xb), mid + lw);
    maxRight = Math.max(maxRight, mHi);
    expand(mLo, mHi);
  }

  var bottom = y + LAY.padBottom;
  var width  = Math.max(maxRight + LAY.padX,
                        col.x[n - 1] + col.headW[n - 1] / 2 + LAY.padX);

  /* 생명선 + 참여자 머리 (머리를 마지막에 그려 선 위에 오게 한다) */
  for (var p = 0; p < n; p++) {
    var px = col.x[p], pw = col.headW[p];
    el("line", { x1: px, y1: LAY.padTop + LAY.headH, x2: px, y2: bottom - 8,
                 "class": "sq-lifeline" }, gLife);
    var pr = seq.participants[p];
    el("rect", { x: px - pw / 2, y: LAY.padTop, width: pw, height: LAY.headH,
                 "class": "sq-head sq-head-" + pr.kind, rx: 4 }, gHead);
    el("text", { x: px, y: LAY.padTop + 20, "class": "sq-headname" }, gHead).textContent = pr.name;
    el("text", { x: px, y: LAY.padTop + 34, "class": "sq-headkind" }, gHead)
      .textContent = KIND_LABEL[pr.kind] || "";
  }

  svg.setAttribute("viewBox", "0 0 " + Math.ceil(width) + " " + Math.ceil(bottom));
  svg.setAttribute("width", Math.ceil(width));
  svg.setAttribute("height", Math.ceil(bottom));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", seq.title + " 시퀀스 다이어그램");
  return svg;
}

var API = {
  P: P,
  actors: ACTORS,
  catalog: CATALOG,
  order: ORDER,
  define: define,
  get: function (id) { return CATALOG[id] || null; },
  idsFor: idsFor,
  coveredCards: coveredCards,
  all: function () { return ORDER.slice(); },
  render: renderSequence
};

global.PokeClipSequences = API;

})(window);
