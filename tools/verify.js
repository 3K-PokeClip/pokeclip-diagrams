/* 브라우저 전수 검증 — 네 문서 공용.
   콘솔에서:  const v = await import('/tools/verify.js'); await v.verify()
   문제를 배열로 돌려준다. 빈 배열이면 통과.                                */
const wait = ms => new Promise(r => setTimeout(r, ms));
const bad = [];
const fail = m => bad.push(m);

const $ = id => document.getElementById(id);
const rectOK = r => r.right <= document.documentElement.clientWidth + 1 && r.left >= -1 &&
                    r.width > 100 && r.height > 100;
const inter = (a, b, p = 0) =>
  a.x < b.x + b.width - p && b.x < a.x + a.width - p &&
  a.y < b.y + b.height - p && b.y < a.y + a.height - p;

/* ── 1. 카탈로그 전체를 화면 밖에서 그려 기하를 본다 ── */
function checkGeometry() {
  const L = window.PokeClipSequences;
  const host = document.createElement("div");
  host.style.cssText = "position:absolute;left:-99999px;top:0";
  document.body.appendChild(host);
  for (const id of L.all()) {
    const s = L.get(id);
    let svg;
    try { svg = L.render(s); } catch (e) { fail(`${id}: 렌더 예외 ${e.message}`); continue; }
    host.appendChild(svg);
    const vb = svg.viewBox.baseVal, W = vb.width, H = vb.height;
    const boxes = [...svg.querySelectorAll("text")].map(t => ({ t, b: t.getBBox(), c: t.getAttribute("class") || "" }));
    for (const { t, b, c } of boxes) {
      if (b.x < -0.5 || b.y < -0.5 || b.x + b.width > W + 0.5 || b.y + b.height > H + 0.5)
        fail(`${id}: 글자 경계 밖 "${t.textContent.slice(0, 26)}"`);
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
      if (inter(boxes[i].b, boxes[j].b, 0.8))
        fail(`${id}: 글자 겹침 "${boxes[i].t.textContent.slice(0, 18)}" × "${boxes[j].t.textContent.slice(0, 18)}"`);
    const notes = [...svg.querySelectorAll("rect.sq-note")].map(r => r.getBBox());
    const heads = [...svg.querySelectorAll("rect.sq-head")].map(r => r.getBBox());
    for (const n of notes) for (const h of heads) if (inter(n, h, 0.5)) fail(`${id}: 설명 상자가 참여자 머리와 겹침`);
    for (const f of [...svg.querySelectorAll("rect.sq-frag")].map(r => r.getBBox()))
      for (const { t, b, c } of boxes) {
        if (c.includes("sq-frag") || c.includes("head")) continue;
        if (b.y > f.y + 2 && b.y + b.height < f.y + f.height - 2 &&
            (b.x < f.x - 0.5 || b.x + b.width > f.x + f.width + 0.5))
          fail(`${id}: 프래그먼트 밖 글자 "${t.textContent.slice(0, 24)}"`);
      }
    svg.remove();
  }
  host.remove();
}

/* ── 2. 카드 · 서랍 · 오버레이 전수 ── */
async function checkCards(expectCards) {
  const dr = $("seqDrawer"), ov = $("seqOverlay");
  const cards = [...document.querySelectorAll(".seqcard")];
  const key = el => el.id || el.dataset.ia || "?";
  if (cards.length !== expectCards) fail(`카드 수 ${cards.length} ≠ 기대 ${expectCards}`);
  if (SeqUI.missing.length) fail(`시퀀스 없는 카드: ${SeqUI.missing.join(", ")}`);
  if (document.querySelectorAll(".seqbadge").length !== cards.length) fail("배지 수가 카드 수와 다르다");

  for (const el of cards) {
    const k = key(el);
    if (el.getAttribute("role") !== "button") fail(`${k}: role=button 없음`);
    if (el.getAttribute("tabindex") !== "0") fail(`${k}: tabindex 없음`);
    if (!el.getAttribute("aria-label")) fail(`${k}: aria-label 없음`);
    if (el.getAttribute("aria-haspopup") !== "dialog") fail(`${k}: aria-haspopup 없음`);
    const b = el.querySelector(".seqbadge");
    if (!b || !/^SEQ \d+$/.test(b.textContent)) fail(`${k}: 배지 형식 이상`);

    el.click(); await wait(330);
    if (dr.hidden) { fail(`${k}: 서랍 안 열림`); continue; }
    if (!rectOK(dr.getBoundingClientRect())) fail(`${k}: 서랍이 화면 밖`);
    if (el.getAttribute("aria-expanded") !== "true") fail(`${k}: aria-expanded 갱신 안 됨`);
    if (!$("sqdTitle").textContent) fail(`${k}: 서랍 제목 없음`);
    const items = [...dr.querySelectorAll(".sqd-item")];
    if (!items.length) fail(`${k}: 목록 비어 있음`);
    if (Number(b.textContent.slice(4)) !== items.length) fail(`${k}: 배지 숫자와 목록 수가 다르다`);
    const p = new URLSearchParams(location.search);
    if (!p.get("card")) fail(`${k}: URL에 card 없음`);

    for (const it of items) {
      it.click(); await wait(35);
      const sk = `${k}/${it.dataset.seq}`;
      if (ov.hidden) fail(`${sk}: 오버레이 안 열림`);
      if (!ov.querySelector("svg.seqsvg")) fail(`${sk}: SVG 없음`);
      if (ov.querySelector(".sqd-err")) fail(`${sk}: 렌더 실패 상자`);
      if (!$("sqoTitle").textContent) fail(`${sk}: 제목 없음`);
      if (!$("sqoPurpose").textContent) fail(`${sk}: 목적 없음`);
      if (new URLSearchParams(location.search).get("sequence") !== it.dataset.seq) fail(`${sk}: URL 미반영`);
      /* 오버레이는 뷰포트를 꽉 채워야 한다. innerWidth 는 스크롤바를 포함하므로
         fixed 요소와 비교할 때는 clientWidth 를 쓴다. */
      const or_ = ov.getBoundingClientRect(), de = document.documentElement;
      if (or_.left !== 0 || or_.top !== 0 ||
          Math.abs(or_.width - de.clientWidth) > 1 || Math.abs(or_.height - de.clientHeight) > 1)
        fail(`${sk}: 오버레이가 화면을 안 채운다 (${Math.round(or_.width)}×${Math.round(or_.height)} vs ${de.clientWidth}×${de.clientHeight})`);
      if (de.scrollWidth > de.clientWidth + 1) fail(`${sk}: 페이지가 가로로 밀림`);
      /* 모달이 떠 있는 동안 배경은 굴러가지 않아야 한다 */
      if (getComputedStyle(de).overflowY !== "hidden") fail(`${sk}: 모달 뒤 배경 스크롤이 안 잠긴다`);
      $("sqoBack").click(); await wait(18);
      if (!ov.hidden) fail(`${sk}: 목록으로 안 돌아감`);
    }
    $("sqdClose").click(); await wait(28);
    if (!dr.hidden) fail(`${k}: 닫히지 않음`);
    if (getComputedStyle(document.documentElement).overflowY === "hidden" &&
        !/hidden/.test(getComputedStyle(document.body).overflow))
      fail(`${k}: 닫았는데 배경 스크롤 잠금이 안 풀린다`);
    if (document.activeElement !== el) fail(`${k}: 포커스가 카드로 안 돌아옴`);
    if (el.getAttribute("aria-expanded") !== "false") fail(`${k}: aria-expanded 되돌아가지 않음`);
  }
  return cards;
}

/* ── 3. 키보드 · 포커스 트랩 · ESC 2단 ── */
async function checkKeyboard(card) {
  const dr = $("seqDrawer"), ov = $("seqOverlay");
  card.focus();
  card.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  await wait(330);
  if (dr.hidden) fail("키보드: Enter로 안 열림");
  if (!document.activeElement.classList.contains("sqd-item")) fail("키보드: 첫 항목으로 포커스 안 감");

  /* 포커스 트랩 — 서랍 안 마지막에서 Tab 하면 첫 요소로 */
  const f = [...dr.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')]
              .filter(x => x.offsetParent !== null);
  f[f.length - 1].focus();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  await wait(20);
  if (!dr.contains(document.activeElement)) fail("키보드: 서랍 포커스 트랩이 새어 나감");

  dr.querySelector(".sqd-item").click(); await wait(40);
  if (ov.hidden) fail("키보드: 시퀀스 안 열림");
  const of_ = [...ov.querySelectorAll("button:not([disabled])")].filter(x => x.offsetParent !== null);
  of_[of_.length - 1].focus();
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  await wait(20);
  if (!ov.contains(document.activeElement)) fail("키보드: 오버레이 포커스 트랩이 새어 나감");

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await wait(30);
  if (!ov.hidden) fail("ESC 1단: 시퀀스가 안 닫힘");
  if (dr.hidden) fail("ESC 1단: 서랍까지 닫혔다");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await wait(30);
  if (!dr.hidden) fail("ESC 2단: 서랍이 안 닫힘");
  if (document.activeElement !== card) fail("ESC 2단: 포커스 복귀 실패");
}

/* ── 4. 최소 클릭 크기 · 대비 ── */
function checkTargets() {
  $("sqdClose") && [...document.querySelectorAll(".sqo-btn, .sqd-close, .sqd-item")].forEach(b => {
    const r = b.getBoundingClientRect();
    if (r.height && r.height < 44) fail(`클릭 대상이 44px 미만: ${b.id || b.className} (${Math.round(r.height)}px)`);
  });
}

/* ── 5. 확대·패닝 보존 ── */
async function checkZoom(card) {
  const inner = $("inner");
  const before = inner.style.transform;
  card.click(); await wait(340);
  const during = inner.style.transform;
  $("sqdClose").click(); await wait(30);
  const after = inner.style.transform;
  if (before !== during || during !== after) fail(`확대·이동 상태가 바뀌었다: ${before} → ${during} → ${after}`);
}

export async function verify(expectCards) {
  bad.length = 0;
  if (!window.PokeClipSequences) { fail("sequences.js 없음"); return bad; }
  if (!window.SeqUI || !SeqUI.cards) { fail("SeqUI 초기화 안 됨"); return bad; }
  checkGeometry();
  const cards = await checkCards(expectCards);
  if (cards.length) {
    await checkKeyboard(cards[Math.floor(cards.length / 2)]);
    checkTargets();
    await checkZoom(cards[0]);
  }
  return bad;
}
