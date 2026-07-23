/* ============================================================================
   PokeClip — 카드 → 시퀀스 인터랙션 레이어 (①②③④ 공용)
   ----------------------------------------------------------------------------
   카드를 누르면 오른쪽 서랍에 "관련 처리 흐름" 목록이 열리고,
   항목을 고르면 전체 화면 Overlay에 시퀀스 다이어그램이 뜬다.

   왜 이렇게 만들었나
   · 카드는 원래 있던 DOM 그대로다. 좌표를 하드코딩한 투명 버튼을 얹지 않으므로
     확대·이동 중에도 클릭 좌표가 어긋나지 않는다.
   · Drawer·Overlay는 position:fixed 라 캔버스 레이아웃을 밀지 않는다.
     → fit() 재계산이 일어나지 않고 확대·스크롤 위치가 그대로 보존된다.
   · 목록의 "내용"은 seq-catalog.js 한 곳에서만 온다. 여기는 화면 전환과 상태만.
   · CSS·DOM을 이 파일이 직접 만든다. 네 문서에 같은 마크업을 네 번 적지 않는다.

   사용법
     SeqUI.init({
       diagram: "system",              // sequences.js 의 FIELD 키
       eyebrow: "실행 단위",            // 서랍 머리의 작은 글씨
       cards: [{ id, el, title, resp }],
       badgeInto: el => el.querySelector(".bd") || el,   // 배지를 붙일 곳
       blocked: () => dragged,          // 드래그 직후의 클릭은 무시
       onOpen: (id, el) => focusNode(id)
     });
============================================================================ */
(function (global) {
"use strict";

var LIB = global.PokeClipSequences;

/* ── 스타일 — 네 문서가 공유하는 토큰(--ink 등)만 쓴다 ─────────────────── */
var CSS = [
"/* 카드가 눌리는 것임을 보이게 */",
".seqcard{cursor:pointer}",
".seqcard:hover{box-shadow:0 0 0 2px var(--ink), 0 2px 0 var(--ink)}",
".seqcard:focus-visible{outline:3px solid var(--ink);outline-offset:3px}",
".seqcard[aria-expanded=\"true\"]{box-shadow:0 0 0 2.6px var(--ink)}",
".seqbadge{font-family:var(--mono);font-size:9px;background:var(--ink);color:#fff;",
"  padding:0 5px;border-radius:2px;letter-spacing:.02em;white-space:nowrap}",

"#seqTip{position:fixed;z-index:60;background:var(--ink);color:#fff;font-size:11.5px;",
"  padding:5px 9px;border-radius:4px;pointer-events:none;max-width:280px;line-height:1.35;",
"  font-family:inherit}",
"#seqTip[hidden]{display:none}",

"#seqScrim{position:fixed;inset:0;z-index:40;background:rgba(12,14,17,.44)}",
"#seqScrim[hidden]{display:none}",

"#seqDrawer{position:fixed;top:0;right:0;bottom:0;width:min(430px,100vw);z-index:50;",
"  background:#fff;border-left:1.5px solid var(--ink);display:flex;flex-direction:column;",
"  font-family:\"Segoe UI\",\"Malgun Gothic\",\"Apple SD Gothic Neo\",sans-serif;",
"  color:var(--ink);font-size:13px;line-height:1.45;transition:transform .22s ease}",
"#seqDrawer[hidden]{display:none}",
"#seqDrawer.slidein{transform:translateX(100%)}",
".sqd-head{padding:16px 54px 12px 18px;border-bottom:1.5px solid var(--ink);flex:0 0 auto;position:relative}",
".sqd-eyebrow{font-family:var(--mono);font-size:10px;color:var(--sub);letter-spacing:.06em}",
".sqd-head h2{font-size:17px;font-weight:800;margin-top:3px;line-height:1.25}",
".sqd-resp{font-size:11.5px;color:var(--sub);line-height:1.5;margin-top:7px}",
".sqd-close{position:absolute;top:10px;right:10px;min-width:44px;min-height:44px;",
"  border:1.3px solid var(--ink);background:#fff;border-radius:4px;cursor:pointer;",
"  font-size:14px;line-height:1;color:var(--ink);font-family:inherit}",
".sqd-close:hover{background:#f3f5f8}",
".sqd-close:focus-visible{outline:3px solid var(--ink);outline-offset:2px}",
".sqd-body{flex:1 1 auto;overflow-y:auto;padding:12px 14px 20px}",
".sqd-cnt{font-size:11px;color:var(--sub);margin:2px 4px 8px;font-family:var(--mono)}",
".sqd-item{display:block;width:100%;text-align:left;min-height:44px;cursor:pointer;",
"  border:1.3px solid var(--ink);border-radius:5px;background:#fff;color:var(--ink);",
"  padding:9px 12px;margin-bottom:8px;font-family:inherit;",
"  transition:box-shadow .14s ease, transform .14s ease, background .14s ease}",
".sqd-item:hover{background:#f3f5f8;box-shadow:0 2px 0 var(--ink);transform:translateY(-1px)}",
".sqd-item:focus-visible{outline:3px solid var(--ink);outline-offset:2px}",
".sqd-item[aria-current=\"true\"]{background:var(--ink);color:#fff}",
".sqd-item[aria-current=\"true\"] .sqd-id,.sqd-item[aria-current=\"true\"] .sqd-trg{color:#c8ccd2}",
".sqd-id{display:block;font-family:var(--mono);font-size:9.5px;color:var(--sub);letter-spacing:.04em}",
".sqd-ttl{display:block;font-weight:700;font-size:13px;margin-top:2px;line-height:1.3}",
".sqd-trg{display:block;font-size:10.5px;color:var(--sub);margin-top:4px;line-height:1.4}",
".sqd-err{border:1.3px solid var(--ink);background:#f4f6f8;padding:10px 12px;",
"  border-radius:5px;margin-bottom:10px;font-size:11.5px;line-height:1.5}",
".sqd-err b{display:block;margin-bottom:3px}",
".sqd-err code{font-family:var(--mono);font-size:11px}",

"#seqOverlay{position:fixed;inset:0;z-index:55;display:flex;flex-direction:column;",
"  background:var(--bg,#fbfbfc);color:var(--ink);",
"  font-family:\"Segoe UI\",\"Malgun Gothic\",\"Apple SD Gothic Neo\",sans-serif;font-size:13px}",
"#seqOverlay[hidden]{display:none}",
".sqo-head{flex:0 0 auto;display:flex;align-items:flex-start;gap:14px;",
"  padding:14px 18px 12px;border-bottom:1.5px solid var(--ink);background:#fff}",
".sqo-htext{flex:1;min-width:0}",
".sqo-eyebrow{font-family:var(--mono);font-size:10px;color:var(--sub);letter-spacing:.06em}",
".sqo-head h2{font-size:18px;font-weight:800;margin-top:2px;line-height:1.25}",
".sqo-purpose{font-size:11.5px;color:var(--sub);line-height:1.5;margin-top:5px;max-width:96ch}",
".sqo-trigger{font-size:11px;color:var(--sub);margin-top:4px}",
".sqo-trigger b{color:var(--ink)}",
".sqo-btns{display:flex;gap:8px;flex:0 0 auto;flex-wrap:wrap;justify-content:flex-end}",
".sqo-btn{min-height:44px;min-width:44px;padding:0 14px;border:1.3px solid var(--ink);",
"  background:#fff;border-radius:5px;cursor:pointer;font-family:inherit;font-size:12px;",
"  font-weight:700;color:var(--ink)}",
".sqo-btn:hover{background:#f3f5f8}",
".sqo-btn:focus-visible{outline:3px solid var(--ink);outline-offset:2px}",
".sqo-btn[disabled]{opacity:.35;cursor:not-allowed}",
".sqo-body{flex:1 1 auto;overflow:auto;padding:16px 18px 26px}",
".sqo-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:10.5px;color:var(--sub);",
"  margin-bottom:12px;align-items:center}",
".sqo-legend span{display:flex;align-items:center;gap:5px}",
".sqo-legend svg{flex:0 0 auto}",
".sqo-notes{margin-top:16px;border-top:1px solid #d3d7dd;padding-top:10px;",
"  font-size:11.5px;color:var(--sub);line-height:1.6;max-width:110ch}",
".sqo-notes b{color:var(--ink)}",
".sqo-notes ul{margin-top:4px}",
".sqo-notes li{margin-left:16px}",
".sqo-count{font-family:var(--mono);font-size:11px;color:var(--sub);align-self:center}",

"/* 시퀀스 다이어그램 — 다른 문서와 같은 색·선 두께·서체 */",
".seqsvg{display:block;max-width:100%;height:auto}",
".seqsvg .sq-lifeline{stroke:var(--faint,#9aa1ab);stroke-width:1.1;stroke-dasharray:4 5}",
".seqsvg .sq-head{fill:#fff;stroke:var(--ink);stroke-width:1.3}",
".seqsvg .sq-head-store{fill:#f1f3f6}",
".seqsvg .sq-head-queue{fill:#f1f3f6;stroke-dasharray:none}",
".seqsvg .sq-head-external{stroke-dasharray:4 3}",
".seqsvg .sq-head-edge{stroke-dasharray:4 3;fill:#fafbfc}",
".seqsvg .sq-head-ops{fill:#f7f8fa}",
".seqsvg .sq-head-human{fill:#fff;stroke-width:1.8}",
".seqsvg .sq-headname{font-size:12.5px;font-weight:700;fill:var(--ink);text-anchor:middle}",
".seqsvg .sq-headkind{font-size:9px;fill:var(--sub);text-anchor:middle;",
"  font-family:var(--mono);letter-spacing:.02em}",
".seqsvg .sq-line{stroke:var(--ink);stroke-width:1.25;fill:none}",
".seqsvg .sq-dash{stroke-dasharray:5 4}",
".seqsvg .sq-self{stroke-width:1.15}",
".seqsvg .sq-head-solid{fill:var(--ink);stroke:none}",
".seqsvg .sq-head-open{fill:none;stroke:var(--ink);stroke-width:1.3}",
".seqsvg .sq-msgtext{font-size:11.5px;font-weight:600;fill:#3a3f47;text-anchor:middle;",
"  paint-order:stroke;stroke:var(--bg,#fbfbfc);stroke-width:3.4px}",
".seqsvg .sq-msgtext-left{text-anchor:start}",
".seqsvg .sq-frag{fill:none;stroke:var(--band-line,#7b828c);stroke-width:1.2;",
"  stroke-dasharray:6 4}",
".seqsvg .sq-fragtab{fill:var(--bg,#fbfbfc);stroke:var(--band-line,#7b828c);stroke-width:1.2}",
".seqsvg .sq-fragtype{font-size:10px;font-weight:700;fill:var(--ink);",
"  font-family:var(--mono)}",
".seqsvg .sq-fragcase{font-size:10.5px;font-weight:700;fill:#3a3f47;",
"  paint-order:stroke;stroke:var(--bg,#fbfbfc);stroke-width:3.4px}",
".seqsvg .sq-fragsplit{stroke:var(--band-line,#7b828c);stroke-width:1;stroke-dasharray:3 4}",
".seqsvg .sq-note{fill:#f4f6f8;stroke:var(--ink);stroke-width:1.1}",
".seqsvg .sq-notetext{font-size:11px;fill:#3a3f47}",

"@media (prefers-reduced-motion:reduce){",
"  #seqDrawer{transition:none}",
"  .sqd-item{transition:none}",
"  .sqd-item:hover{transform:none}",
"}"
].join("\n");

var MARKUP =
'<div id="seqTip" role="tooltip" hidden></div>' +
'<div id="seqScrim" hidden></div>' +
'<aside id="seqDrawer" role="dialog" aria-modal="true" aria-labelledby="sqdTitle" hidden>' +
  '<div class="sqd-head">' +
    '<div class="sqd-eyebrow" id="sqdEyebrow"></div>' +
    '<h2 id="sqdTitle"></h2>' +
    '<p class="sqd-resp" id="sqdResp"></p>' +
    '<button type="button" class="sqd-close" id="sqdClose" aria-label="닫기 (Esc)">&#10005;</button>' +
  '</div>' +
  '<div class="sqd-body" id="sqdBody"></div>' +
'</aside>' +
'<div id="seqOverlay" role="dialog" aria-modal="true" aria-labelledby="sqoTitle" hidden>' +
  '<div class="sqo-head">' +
    '<div class="sqo-htext">' +
      '<div class="sqo-eyebrow" id="sqoEyebrow"></div>' +
      '<h2 id="sqoTitle"></h2>' +
      '<p class="sqo-purpose" id="sqoPurpose"></p>' +
      '<div class="sqo-trigger" id="sqoTrigger"></div>' +
    '</div>' +
    '<div class="sqo-btns">' +
      '<span class="sqo-count" id="sqoCount"></span>' +
      '<button type="button" class="sqo-btn" id="sqoPrev">&#8592; 이전</button>' +
      '<button type="button" class="sqo-btn" id="sqoNext">다음 &#8594;</button>' +
      '<button type="button" class="sqo-btn" id="sqoBack">목록으로</button>' +
      '<button type="button" class="sqo-btn" id="sqoClose" aria-label="닫고 다이어그램으로 (Esc)">&#10005; 닫기</button>' +
    '</div>' +
  '</div>' +
  '<div class="sqo-body" id="sqoBody"></div>' +
'</div>';

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
  });
}

/* ── 초기화 ─────────────────────────────────────────────────────────── */
function init(cfg) {
  var NOOP = { isOpen: function () { return false; }, has: function () { return false; },
               open: function () {}, close: function () {}, cards: [] };
  if (!LIB) { console.warn("[SeqUI] sequences.js 가 없습니다"); return NOOP; }

  var style = document.createElement("style");
  style.id = "seq-ui-style"; style.textContent = CSS;
  document.head.appendChild(style);
  var host = document.createElement("div");
  host.id = "seq-ui-root"; host.innerHTML = MARKUP;
  while (host.firstChild) document.body.appendChild(host.firstChild);

  var tip     = document.getElementById("seqTip");
  var scrim   = document.getElementById("seqScrim");
  var drawer  = document.getElementById("seqDrawer");
  var overlay = document.getElementById("seqOverlay");

  var DIAGRAM = cfg.diagram;
  var blocked = cfg.blocked || function () { return false; };
  var badgeInto = cfg.badgeInto || function (el) { return el; };

  /* 카드 등록 — 시퀀스가 하나도 안 걸린 카드는 여기서 드러난다 */
  var CARDS = {};        /* id → {id, el, title, resp, ids} */
  var missing = [];
  (cfg.cards || []).forEach(function (c) {
    if (!c.el) return;
    var ids = LIB.idsFor(DIAGRAM, c.id);
    if (!ids.length) { missing.push(c.id); return; }
    CARDS[c.id] = { id: c.id, el: c.el, title: c.title || c.id, resp: c.resp || "", ids: ids };
    decorate(CARDS[c.id]);
  });
  if (missing.length) {
    console.warn("[SeqUI] 시퀀스가 연결되지 않은 카드 " + missing.length + "개:", missing);
  }

  var cur = null;          /* 현재 카드 */
  var openSeq = null;      /* 현재 열린 시퀀스 id */
  var drawerOn = false;
  var lastFocus = null;

  /* ── 카드를 진짜 버튼처럼 ── */
  function decorate(c) {
    var el = c.el;
    el.classList.add("seqcard");
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-haspopup", "dialog");
    el.setAttribute("aria-expanded", "false");
    el.setAttribute("aria-label", c.title + " — 관련 처리 흐름 " + c.ids.length + "개 보기");
    el.setAttribute("aria-describedby", "seqTip");
    var b = document.createElement("span");
    b.className = "seqbadge"; b.textContent = "SEQ " + c.ids.length;
    (badgeInto(el) || el).appendChild(b);

    el.addEventListener("mouseenter", function () { showTip(c); });
    el.addEventListener("mouseleave", hideTip);
    el.addEventListener("focus", function () { showTip(c); });
    el.addEventListener("blur", hideTip);
    /* 마우스 클릭은 문서 자신의 클릭 핸들러가 먼저 강조를 잡는다.
       그래서 notify:false — 여기서 또 강조를 건드리면 토글돼 꺼진다.
       키보드로 열 때는 그 핸들러가 돌지 않으므로 notify:true 로 알려 준다. */
    el.addEventListener("click", function () {
      if (blocked()) return;
      openDrawer(c.id, { push: true, focus: true, notify: false });
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        openDrawer(c.id, { push: true, focus: true, notify: true });
      }
    });
  }

  /* ── Tooltip: 화면 고정 좌표라 확대해도 글씨 크기가 유지된다 ── */
  function showTip(c) {
    if (drawerOn || openSeq) return;
    tip.textContent = "관련 처리 흐름 " + c.ids.length + "개 보기";
    tip.hidden = false;
    var r = c.el.getBoundingClientRect();
    var tw = tip.offsetWidth, th = tip.offsetHeight;
    var x = r.left + r.width / 2 - tw / 2;
    var y = r.top - th - 9;
    if (y < 6) y = r.bottom + 9;
    if (y + th > innerHeight - 6) y = Math.max(6, innerHeight - th - 6);
    tip.style.left = Math.max(6, Math.min(x, innerWidth - tw - 6)) + "px";
    tip.style.top = y + "px";
  }
  function hideTip() { tip.hidden = true; }

  /* ── URL 상태 ── */
  function params() { return new URLSearchParams(location.search); }
  function writeURL(push) {
    var p = params();
    if (drawerOn && cur) { p.set("diagram", DIAGRAM); p.set("card", cur.id); }
    else { p.delete("diagram"); p.delete("card"); }
    if (openSeq) p.set("sequence", openSeq); else p.delete("sequence");
    var qs = p.toString();
    var url = location.pathname + (qs ? "?" + qs : "") + location.hash;
    if (push) history.pushState({ seq: true }, "", url);
    else history.replaceState({ seq: true }, "", url);
  }

  /* ── 배경 스크롤 잠금 ──
     aria-modal 을 걸어 둔 레이어 뒤에서 페이지가 같이 굴러가면 안 된다.
     ②처럼 본문이 스크롤되는 문서에서만 실제로 달라지고, ①③④는 이미
     body{overflow:hidden} 이라 아무 일도 일어나지 않는다. */
  var _prevOverflow = null;
  function lockScroll(on) {
    var d = document.documentElement;
    if (on) {
      if (_prevOverflow !== null) return;
      _prevOverflow = d.style.overflow;
      d.style.overflow = "hidden";
    } else {
      if (_prevOverflow === null) return;
      d.style.overflow = _prevOverflow;
      _prevOverflow = null;
    }
  }

  /* ── Focus trap ── */
  var FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])';
  function topLayer() { return openSeq ? overlay : (drawerOn ? drawer : null); }
  function trap(e) {
    if (e.key !== "Tab") return;
    var layer = topLayer(); if (!layer) return;
    var f = [].slice.call(layer.querySelectorAll(FOCUSABLE))
              .filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ── Drawer ── */
  function buildDrawer(badId) {
    document.getElementById("sqdEyebrow").textContent = cfg.eyebrow || "";
    document.getElementById("sqdTitle").textContent = cur.title;
    document.getElementById("sqdResp").textContent = cur.resp;
    var body = document.getElementById("sqdBody");
    body.textContent = "";
    if (badId) {
      var w = document.createElement("div");
      w.className = "sqd-err";
      w.innerHTML = "<b>요청한 시퀀스를 찾을 수 없습니다</b>" +
        "<code>" + escapeHtml(badId) + "</code> 는 카탈로그에 없습니다. 아래 목록에서 선택해 주세요.";
      body.appendChild(w);
    }
    var cnt = document.createElement("div");
    cnt.className = "sqd-cnt";
    cnt.textContent = "관련 처리 흐름 " + cur.ids.length + "개";
    body.appendChild(cnt);
    cur.ids.forEach(function (id) {
      var s = LIB.get(id); if (!s) return;
      var btn = document.createElement("button");
      btn.type = "button"; btn.className = "sqd-item"; btn.dataset.seq = id;
      btn.setAttribute("aria-current", String(openSeq === id));
      btn.innerHTML =
        '<span class="sqd-id">' + escapeHtml(id) + "</span>" +
        '<span class="sqd-ttl">' + escapeHtml(s.title) + "</span>" +
        '<span class="sqd-trg">트리거 · ' + escapeHtml(s.trigger) + "</span>";
      btn.addEventListener("click", function () { openSequence(id, { push: true }); });
      body.appendChild(btn);
    });
  }

  function openDrawer(cardId, opt) {
    opt = opt || {};
    var c = CARDS[cardId];
    if (!c) return;
    var switching = drawerOn && cur !== c;
    if (cur && cur !== c) cur.el.setAttribute("aria-expanded", "false");
    cur = c;
    if (switching) openSeq = null;
    if (!drawerOn) {
      lastFocus = c.el;
      drawerOn = true;
      scrim.hidden = false; drawer.hidden = false;
      /* 미끄러져 들어오되, 최종 위치가 애니메이션 완료에 의존하지 않게 한다.
         배경 탭·합성이 멈춘 창에서는 rAF도 트랜지션도 진행되지 않아
         Drawer가 화면 밖(translateX 100%)에 갇힌다. 강제 리플로우로 시작점을
         만들고, 타이머로 끝 상태를 못 박는다(타이머는 그 상황에서도 돈다). */
      drawer.style.transform = "";
      drawer.classList.add("slidein");
      void drawer.offsetWidth;
      drawer.classList.remove("slidein");
      clearTimeout(drawer.__settle);
      drawer.__settle = setTimeout(function () {
        drawer.style.transition = "none";
        drawer.style.transform = "none";
        void drawer.offsetWidth;
        drawer.style.transition = "";
      }, 300);
      lockScroll(true);
      document.addEventListener("keydown", trap, true);
    } else {
      lastFocus = c.el;
    }
    if (switching) { overlay.hidden = true; }
    buildDrawer(opt.badId);
    c.el.setAttribute("aria-expanded", "true");
    hideTip();
    if (opt.notify !== false && cfg.onOpen) cfg.onOpen(c.id, c.el);
    if (opt.focus !== false) {
      var f = drawer.querySelector(".sqd-item") || document.getElementById("sqdClose");
      if (f) f.focus();
    }
    writeURL(opt.push);
  }

  function closeDrawer(opt) {
    opt = opt || {};
    if (!drawerOn) return;
    drawerOn = false; openSeq = null;
    clearTimeout(drawer.__settle);
    drawer.style.transform = "";      /* 다음 열기의 시작점을 되돌린다 */
    drawer.classList.remove("slidein");
    drawer.hidden = true; scrim.hidden = true; overlay.hidden = true;
    if (cur) cur.el.setAttribute("aria-expanded", "false");
    lockScroll(false);
    document.removeEventListener("keydown", trap, true);
    writeURL(opt.push);
    if (cfg.onClose) cfg.onClose();
    if (opt.focus !== false && lastFocus) lastFocus.focus();
    cur = null;
  }

  /* ── Overlay (시퀀스 상세) ── */
  function openSequence(id, opt) {
    opt = opt || {};
    if (!cur) return;
    var s = LIB.get(id);
    if (!s || cur.ids.indexOf(id) < 0) {
      openDrawer(cur.id, { push: opt.push, badId: id, focus: true, notify: false });
      return;
    }
    openSeq = id;
    [].forEach.call(drawer.querySelectorAll(".sqd-item"), function (b) {
      b.setAttribute("aria-current", String(b.dataset.seq === id));
    });

    document.getElementById("sqoEyebrow").textContent = s.id + " · " + cur.title;
    document.getElementById("sqoTitle").textContent = s.title;
    document.getElementById("sqoPurpose").textContent = s.purpose;
    document.getElementById("sqoTrigger").innerHTML = "<b>트리거</b> · " + escapeHtml(s.trigger);
    var pos = cur.ids.indexOf(id);
    document.getElementById("sqoCount").textContent = (pos + 1) + " / " + cur.ids.length;
    document.getElementById("sqoPrev").disabled = pos <= 0;
    document.getElementById("sqoNext").disabled = pos >= cur.ids.length - 1;

    var body = document.getElementById("sqoBody");
    body.textContent = "";
    body.appendChild(legend());
    try {
      var svg = LIB.render(s);
      if (!svg) throw new Error("빈 렌더 결과");
      body.appendChild(svg);
    } catch (err) {
      var w = document.createElement("div");
      w.className = "sqd-err";
      w.innerHTML = "<b>시퀀스를 그리지 못했습니다</b>" +
        "이 시퀀스만 표시에 실패했습니다. 다른 흐름은 정상입니다. " +
        "'목록으로'를 눌러 다른 흐름을 선택할 수 있습니다.";
      body.appendChild(w);
      console.warn("[SeqUI] render 실패:", id, err);
    }
    if (s.notes && s.notes.length) {
      var n = document.createElement("div");
      n.className = "sqo-notes";
      n.innerHTML = "<b>덧붙임</b><ul>" +
        s.notes.map(function (t) { return "<li>" + escapeHtml(t) + "</li>"; }).join("") + "</ul>";
      body.appendChild(n);
    }
    body.scrollTop = 0;
    overlay.hidden = false;
    writeURL(opt.push);
    if (opt.focus !== false) document.getElementById("sqoBack").focus();
  }

  function closeSequence(opt) {
    opt = opt || {};
    if (!openSeq) return;
    openSeq = null;
    overlay.hidden = true;
    [].forEach.call(drawer.querySelectorAll(".sqd-item"), function (b) {
      b.setAttribute("aria-current", "false");
    });
    writeURL(opt.push);
    if (opt.focus !== false) {
      var back = drawer.querySelector(".sqd-item[data-seq]");
      (back || document.getElementById("sqdClose")).focus();
    }
  }

  function step(d) {
    if (!cur) return;
    var i = cur.ids.indexOf(openSeq);
    if (i < 0) return;
    var j = i + d;
    if (j < 0 || j >= cur.ids.length) return;
    openSequence(cur.ids[j], { push: true });
  }

  function legend() {
    var box = document.createElement("div");
    box.className = "sqo-legend";
    var mk = function (d, extra, label) {
      return '<span><svg width="42" height="10" aria-hidden="true">' +
        '<line x1="1" y1="5" x2="32" y2="5" stroke="#16181c" stroke-width="1.25" ' + extra + '></line>' +
        d + "</svg>" + label + "</span>";
    };
    box.innerHTML =
      mk('<path d="M32,1.6 L40,5 L32,8.4 Z" fill="#16181c"/>', "", "동기 호출") +
      mk('<path d="M32.8,1.6 L40,5 L32.8,8.4" fill="none" stroke="#16181c" stroke-width="1.3"/>', "", "비동기 전달") +
      mk('<path d="M32.8,1.6 L40,5 L32.8,8.4" fill="none" stroke="#16181c" stroke-width="1.3"/>',
         'stroke-dasharray="5 4"', "응답") +
      mk('<rect x="33" y="2.1" width="5.8" height="5.8" fill="#16181c"/>', "", "저장소 · 큐 읽기·쓰기") +
      "<span>점선 상자 = alt · opt · loop</span>" +
      "<span>시간은 위 → 아래</span>";
    return box;
  }

  /* ── 버튼 · 키보드 ── */
  document.getElementById("sqdClose").addEventListener("click", function () { closeDrawer({ push: true }); });
  document.getElementById("sqoBack").addEventListener("click", function () { closeSequence({ push: true }); });
  document.getElementById("sqoClose").addEventListener("click", function () { closeDrawer({ push: true }); });
  document.getElementById("sqoPrev").addEventListener("click", function () { step(-1); });
  document.getElementById("sqoNext").addEventListener("click", function () { step(1); });
  scrim.addEventListener("click", function () { closeDrawer({ push: true }); });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (openSeq) { e.stopPropagation(); closeSequence({ push: true }); }
    else if (drawerOn) { e.stopPropagation(); closeDrawer({ push: true }); }
  });

  /* ── URL → 화면 (최초 진입 · 뒤로/앞으로) ── */
  function applyURL() {
    var p = params();
    var wantCard = p.get("diagram") === DIAGRAM ? p.get("card") : null;
    var wantSeq = p.get("sequence");
    if (!wantCard || !CARDS[wantCard]) {
      if (drawerOn) closeDrawer({ push: false, focus: false });
      return;
    }
    if (!drawerOn || !cur || cur.id !== wantCard) {
      openDrawer(wantCard, { push: false, focus: false, notify: true });
    }
    if (wantSeq) {
      if (LIB.get(wantSeq) && cur.ids.indexOf(wantSeq) >= 0) {
        if (openSeq !== wantSeq) openSequence(wantSeq, { push: false, focus: false });
      } else {
        if (openSeq) closeSequence({ push: false, focus: false });
        buildDrawer(wantSeq);
      }
    } else if (openSeq) {
      closeSequence({ push: false, focus: false });
    }
  }
  window.addEventListener("popstate", applyURL);
  applyURL();

  var ctl = {
    isOpen: function () { return drawerOn || !!openSeq; },
    has: function (id) { return !!CARDS[id]; },
    open: function (id, opt) { openDrawer(id, opt || { push: true, focus: true, notify: false }); },
    close: function () { closeDrawer({ push: true }); },
    cards: Object.keys(CARDS),
    missing: missing
  };
  global.SeqUI = Object.assign(ctl, { init: init });
  return ctl;
}

global.SeqUI = { init: init };

})(window);
