global.window = global;
global.document = { createElementNS:()=>({setAttribute(){},appendChild(){},style:{},getComputedTextLength:()=>0,set textContent(v){}}), body:{appendChild(){}} };
require(require('path').join(__dirname,'..','sequences.js')); require(require('path').join(__dirname,'..','seq-catalog.js'));
const S = global.PokeClipSequences;
const rows = S.all().map(id=>{
  const s = S.get(id);
  let depth=0, maxd=0, frags=0;
  for(const st of s.steps){
    if(st.kind==='fragStart'){depth++;frags++;maxd=Math.max(maxd,depth);}
    else if(st.kind==='fragEnd') depth--;
  }
  const score = s.steps.length + s.participants.length*2 + maxd*4 + frags*2;
  return {id, p:s.participants.length, steps:s.steps.length, frags, nest:maxd, score};
});
rows.sort((a,b)=>b.score-a.score);
console.log('id'.padEnd(14),'참여','단계','프래','중첩','점수');
for(const r of rows) console.log(r.id.padEnd(14), String(r.p).padStart(3), String(r.steps).padStart(4), String(r.frags).padStart(3), String(r.nest).padStart(3), String(r.score).padStart(5));
