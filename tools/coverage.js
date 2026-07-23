const path=require('path');
global.window = global;
global.document = { createElementNS:()=>({setAttribute(){},appendChild(){},style:{},getComputedTextLength:()=>0,set textContent(v){}}), body:{appendChild(){}} };
require(path.join(__dirname,'..','sequences.js')); require(path.join(__dirname,'..','seq-catalog.js'));
const S = global.PokeClipSequences;
for(const d of ['system','service','usecase','ia']){
  const cards = S.coveredCards(d);
  const cnt = cards.map(c=>({c, n:S.idsFor(d,c).length})).sort((a,b)=>a.n-b.n);
  console.log(`\n== ${d} — 카드 ${cards.length}, 시퀀스 1개뿐인 카드: ==`);
  console.log(cnt.filter(x=>x.n<=1).map(x=>x.c+'('+x.n+')').join(' ') || '(없음)');
}
