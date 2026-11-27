const assert=require('node:assert/strict'),fs=require('node:fs');const M=require('./economic-margin.js');
const R='2026-11-26',base=[
 {id:'offer',snapshot_type:'offer',as_of:'2026-11-01',forecast_revenue:150000,total_cost:120000},
 {id:'initial',snapshot_type:'pm_initial',as_of:'2026-11-02',forecast_revenue:150000,total_cost:125000},
 {id:'forecast',snapshot_type:'forecast',as_of:R,forecast_revenue:150000,total_cost:127000,actual_cost:54000,remaining_cost:73000}
];
const f=records=>M.summary({records,date:R});
assert.equal(f(base).offerMargin,20);assert.equal(f(base).hasK,false);
assert.match(M.render({records:base,date:R}),/No se consideran costes indirectos mediante factor K/);
assert.equal(M.effectiveCost(120000,null,false),120000);
assert.equal(M.effectiveCost(120000,0,false),120000);
assert.equal(M.effectiveCost(120000,5,true),120000);
assert.equal(M.effectiveCost(120000,5,false),126000);
const withK=base.concat([{id:'k',snapshot_type:'k_setting',as_of:R,k_indirect_pct:5,total_cost:0,created_at:'2026-11-26T10:00:00Z'}]);
const m=f(withK);assert.equal(m.kPercent,5);assert.equal(m.finalCost,133350);assert.equal(m.indirectCharge,6350);
assert.equal(m.offerCostWithK,126000);assert(Math.abs(m.offerMargin-16)<1e-8);
assert(Math.abs(m.currentMargin-11.1)<1e-8);assert.equal(m.benefit,16650);
assert.equal(f(withK.concat([{snapshot_type:'k_setting',as_of:R,k_indirect_pct:0,total_cost:0,created_at:'2026-11-26T12:00:00Z'}])).hasK,true);
assert.equal(f(withK.concat([{snapshot_type:'k_setting',as_of:R,k_indirect_pct:0,total_cost:0,created_at:'2026-11-26T12:00:00Z'}])).currentMargin,f(base).currentMargin);
const unset=withK.concat([{snapshot_type:'k_setting',as_of:R,k_indirect_pct:null,total_cost:0,created_at:'2026-11-26T15:00:00Z'}]);
assert.equal(f(unset).kPercent,null);assert.equal(f(unset).finalCost,127000);
const included=base.map(x=>({...x,cost_includes_indirect:true}));
assert.equal(f(included.concat(withK.slice(-1))).finalCost,127000);
assert.equal(f(included.concat(withK.slice(-1))).offerMargin,20);
assert.equal(M.effectiveCost(-1,5,false),null);
assert.equal(M.validK(101),false);
assert.equal(M.validK(0),true);
assert.match(M.marginHistory(withK,R,m),/Indirectos previstos por K/);
assert.doesNotMatch(M.render({records:withK,date:R}),/<(?:button|input|form)\b/);
assert.match(M.chart(withK,m.offerMargin,R,5),/svg/);
assert.equal(f(base).rawFinalCost,127000);
assert.equal(f(withK).rawFinalCost,127000);
assert.equal(JSON.stringify(base),JSON.stringify(base),'No saved cost records may be mutated');
const formK={
 querySelector(sel){const m={'#ecMarginKind':{value:'k_setting'},'#ecMarginK':{value:'4.75'},'#ecMarginNote':{value:'Indirectos obra'}};return m[sel]||null;}
};
const k=M.parseForm(formK,{id:'work-1',date:R});assert.equal(k.snapshot_type,'k_setting');assert.equal(k.total_cost,0);assert.equal(k.k_indirect_pct,4.75);assert.equal(k.forecast_revenue,null);
assert.equal(k.cost_includes_indirect,null);
const removeK={querySelector:s=>s==='#ecMarginK'?{value:''}:s==='#ecMarginKind'?{value:'k_setting'}:s==='#ecMarginNote'?{value:''}:null};
assert.equal(M.parseForm(removeK,{id:'work-1',date:R}).k_indirect_pct,null);
const invalid={querySelector:s=>s==='#ecMarginK'?{value:'140'}:s==='#ecMarginKind'?{value:'k_setting'}:s==='#ecMarginNote'?{value:''}:null};
assert.throws(()=>M.parseForm(invalid,{id:'work-1',date:R}),/entre 0 % y 100 %/);
const html=fs.readFileSync('index.html','utf8');
assert.match(fs.readFileSync('economic-v1.js','utf8'),/ecKEdit/);
assert.match(fs.readFileSync('economic-margin.css','utf8'),/ec-k-warning/);
assert.match(html,/economic-margin.js/);
console.log('PASS: K optional/zero/change/unset, indirect double-count guard, BAC/AC base remains untouched, offer and PM margin, chart and K form');
