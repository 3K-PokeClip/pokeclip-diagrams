/* 회귀 검증 — 시퀀스 기능을 붙이기 전부터 있던 것들이 그대로인가.
   콘솔에서: const r = await import('/tools/regress.js'); await r.regress('system')  */
const wait = ms => new Promise(r => setTimeout(r, ms));

export async function regress(kind) {
  const bad = [];
  const fail = m => bad.push(m);
  const $ = id => document.getElementById(id);

  /* 외부 리소스를 끌어오지 않는 self-contained 원칙 */
  [...document.querySelectorAll("script[src],link[href],img[src]")].forEach(e => {
    const u = e.getAttribute("src") || e.getAttribute("href");
    if (/^(https?:)?\/\//.test(u)) fail(`외부 리소스: ${u}`);
  });
  if (document.querySelector('meta[http-equiv="Content-Security-Policy"]')) fail("CSP 메타가 새로 생겼다");
  if (document.querySelector("iframe")) fail("iframe이 새로 생겼다");

  if (kind === "ia") {
    /* ② — 관계 강조가 없는 문서. 단계 필터와 줌만 본다 */
    const chips = [...document.querySelectorAll(".pchip")];
    if (chips.length !== 3) fail(`단계 칩 ${chips.length}개`);
    chips[0].click(); await wait(60);
    if (!$("inner").classList.contains("pfilter")) fail("P1 필터가 안 걸린다");
    if (![...document.querySelectorAll(".n[data-phase]")].some(n => n.classList.contains("poff")))
      fail("P1 필터로 흐려지는 노드가 없다");
    chips[0].click(); await wait(60);
    if ($("inner").classList.contains("pfilter")) fail("필터가 안 풀린다");
    const before = $("inner").style.transform;
    $("btnZin").click(); await wait(40);
    if ($("inner").style.transform === before) fail("확대 버튼이 안 먹는다");
    $("btnFit").click(); await wait(40);
    return bad;
  }

  /* ①③④ 공통 — 강조·단계 필터·줌 */
  const wrap = $("wrap");
  const nodeSel = kind === "usecase" ? ".uc" : ".node";
  const nodes = [...document.querySelectorAll(nodeSel)];
  if (!nodes.length) fail("카드가 하나도 없다");

  /* 앞선 검사가 카드를 고정해 뒀을 수 있다. 고정 상태에서는 호버가 무시되는 게
     원래 동작이라, 호버 검사 전에 Esc로 반드시 풀어 둔다. */
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await wait(40);
  if (document.querySelector(`${nodeSel}.pinned`)) fail("Esc로 고정이 안 풀린다");

  /* 호버 강조: 켜지는 것이 있고, 전부는 아니어야 한다 */
  for (const n of nodes.slice(0, 8)) {
    n.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    await wait(30);
    if (!wrap.classList.contains("focus")) fail(`${n.id}: 호버해도 강조 모드가 아니다`);
    const lit = document.querySelectorAll(`${nodeSel}.lit`).length;
    const onLines = document.querySelectorAll("#wires path.on, #wires circle.on").length;
    if (lit === 0) fail(`${n.id}: 호버했는데 켜지는 카드가 없다`);
    if (lit === nodes.length) fail(`${n.id}: 호버했는데 전부 켜진다`);
    if (kind !== "usecase" && onLines === 0) fail(`${n.id}: 호버했는데 켜지는 선이 없다`);
    n.dispatchEvent(new MouseEvent("mouseout", { bubbles: true }));
    await wait(20);
  }
  if (wrap.classList.contains("focus")) fail("호버를 뗐는데 강조가 안 풀린다");

  /* 단계 필터 */
  const chips = [...document.querySelectorAll(".pchip")];
  if (chips.length !== 3) fail(`단계 칩 ${chips.length}개`);
  chips[0].click(); await wait(60);
  if (!wrap.classList.contains("pfilter")) fail("P1 필터가 안 걸린다");
  chips[0].click(); await wait(60);
  if (wrap.classList.contains("pfilter")) fail("필터가 안 풀린다");

  /* 흐름 칩 (③④만) */
  if (kind !== "usecase") {
    const f = document.querySelector(".fchip");
    if (!f) fail("흐름 칩이 없다");
    else {
      f.click(); await wait(60);
      if (!f.classList.contains("act")) fail("흐름 칩이 안 켜진다");
      if (!document.querySelectorAll("#wires path.on").length) fail("흐름 칩으로 켜지는 선이 없다");
      f.click(); await wait(60);
      if (f.classList.contains("act")) fail("흐름 칩이 안 꺼진다");
    }
  }

  /* 줌 · 맞춤 */
  const before = $("inner").style.transform;
  $("btnIn").click(); await wait(40);
  if ($("inner").style.transform === before) fail("확대 버튼이 안 먹는다");
  $("btnFit").click(); await wait(60);

  /* ESC로 강조 해제가 여전히 되는가 */
  nodes[0].click(); await wait(340);
  document.getElementById("sqdClose").click(); await wait(40);
  nodes[0].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await wait(40);
  if (document.querySelector(`${nodeSel}.pinned`)) fail("ESC로 고정 강조가 안 풀린다");

  return bad;
}
