/* 해상도별 레이아웃만 빠르게 본다 — 서랍·오버레이 위치, 버튼 크기, 스크롤 잠금.
   콘솔에서: const l = await import('/tools/layout.js'); await l.layout()          */
const wait = ms => new Promise(r => setTimeout(r, ms));

export async function layout() {
  const bad = [];
  const fail = m => bad.push(m);
  const de = document.documentElement;
  const dr = document.getElementById("seqDrawer"), ov = document.getElementById("seqOverlay");
  const cards = [...document.querySelectorAll(".seqcard")];

  for (const el of cards) {
    const k = el.id || el.dataset.ia;
    el.click(); await wait(360);
    const r = dr.getBoundingClientRect();
    if (r.right > de.clientWidth + 1 || r.left < 0 || r.width < 100) fail(`${k}: 서랍 위치 (${Math.round(r.left)}~${Math.round(r.right)} / ${de.clientWidth})`);
    if (r.top !== 0 || Math.abs(r.height - de.clientHeight) > 1) fail(`${k}: 서랍 높이가 화면과 다르다`);
    const body = document.getElementById("sqdBody");
    if (getComputedStyle(body).overflowY !== "auto") fail(`${k}: 서랍 본문에 스크롤이 없다`);

    dr.querySelector(".sqd-item").click(); await wait(60);
    const o = ov.getBoundingClientRect();
    if (o.left !== 0 || o.top !== 0 || Math.abs(o.width - de.clientWidth) > 1 || Math.abs(o.height - de.clientHeight) > 1)
      fail(`${k}: 오버레이가 화면을 안 채운다`);
    if (getComputedStyle(de).overflowY !== "hidden") fail(`${k}: 배경 스크롤이 안 잠긴다`);
    for (const b of ov.querySelectorAll(".sqo-btn")) {
      const q = b.getBoundingClientRect();
      if (q.height < 44) fail(`${k}: ${b.id} 높이 ${Math.round(q.height)}px`);
      if (q.right > de.clientWidth + 1 || q.left < 0) fail(`${k}: ${b.id} 가 화면 밖`);
    }
    const sb = document.getElementById("sqoBody");
    if (getComputedStyle(sb).overflow !== "auto") fail(`${k}: 오버레이 본문에 스크롤이 없다`);
    const svg = sb.querySelector("svg.seqsvg");
    if (svg && svg.getBoundingClientRect().height < 40) fail(`${k}: 시퀀스가 납작하게 눌렸다`);
    if (de.scrollWidth > de.clientWidth + 1) fail(`${k}: 페이지 가로 밀림`);

    document.getElementById("sqoClose").click(); await wait(40);
    if (getComputedStyle(de).overflowY === "hidden" && getComputedStyle(document.body).overflow !== "hidden")
      fail(`${k}: 닫았는데 스크롤 잠금이 안 풀린다`);
  }
  return { cards: cards.length, w: de.clientWidth, h: de.clientHeight, bad: [...new Set(bad)] };
}
