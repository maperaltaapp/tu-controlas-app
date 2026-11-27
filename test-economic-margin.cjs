const assert=require('node:assert/strict');
const M=require('./economic-margin.js');
const date='2026-11-26';
const records=[
 {snapshot_type:'offer',as_of:'2026-11-01',total_cost:120000,forecast_revenue:150000,created_at:'2026-11-01T10:00:00Z'},
 {snapshot_type:'pm_initial',as_of:'2026-11-02',total_cost:125000,forecast_revenue:150000,created_at:'2026-11-02T10:00:00Z'},
 {snapshot_type:'forecast',as_of:'2026-11-26',total_cost:127000,actual_cost:54000,remaining_cost:73000,forecast_revenue:150000,created_at:'2026-11-26T10:00:00Z'}
];
const before=JSON.stringify(records),s=M.summary({records,date,offerCost:120000,contract:150000});
assert.equal(s.offerMargin,20);
assert(Math.abs(s.initialMargin-16.6666666666667)<1e-8);
assert(Math.abs(s.currentMargin-15.3333333333333)<1e-8);
assert(Math.abs(s.gapOffer+4.66666666666667)<1e-8);
assert.equal(s.finalCost,127000);
assert.equal(s.benefit,23000);
assert.equal(s.offerCost,120000);
assert.equal(M.margin(0,100),null);
assert.equal(M.summary({records:[],date,offerCost:120000,contract:150000}).offerMargin,null,'Draft cost entries must not become an approved offer automatically.');
assert.equal(M.summary({records:records.slice(0,2),date}).finalCost,125000,'Before the first review use the PM initial estimate.');
assert.equal(M.summary({records,date:'2026-11-10'}).finalCost,125000,'Future reviews must not leak into earlier snapshots.');
assert.equal(JSON.stringify(records),before,'Read-only summaries must not alter history.');
assert.match(M.render({records,date,offerCost:120000,contract:150000}),/Previsión de cierre/);
assert.match(M.chart(records,20,date),/role="img"/);

const p={phases:[
 {id:'a',weight:40,start:'2026-11-01',end:'2026-11-10',observations:[{date:'2026-11-05',percent:50}]},
 {id:'b',weight:60,start:'2026-11-01',end:'2026-11-10',observations:[{date:'2026-11-05',percent:25}]}
],baseline:[
 {id:'a',start:'2026-11-01',end:'2026-11-10'},
 {id:'b',start:'2026-11-01',end:'2026-11-10'}
],baseline_at:'2026-10-31T12:00:00Z'};
const costs=[{kind:'actual',activity_id:'a',amount:300,entry_date:'2026-11-05'},{kind:'actual',activity_id:'b',amount:500,entry_date:'2026-11-05'}];
const approved={snapshot_type:'baseline',total_cost:3000,activity_costs:[{activity_id:'a',amount:1000},{activity_id:'b',amount:2000}]};
const ev=M.evm(p,costs,'2026-11-05',approved);
assert.equal(ev.bac,3000);assert.equal(ev.pv,1500);assert.equal(ev.ev,1000);assert.equal(ev.ac,800);
assert.equal(ev.cpi,1.25);assert.equal(ev.spi,2/3);assert.equal(ev.eacTrend,2400);
assert.equal(M.evm(p,costs,'2026-11-05',null).cpi,null,'Do not report CPI without approved baseline.');
assert.equal(M.evm(p,costs.slice(0,1),'2026-11-05',approved).ac,null,'Partial real costs cannot be assumed zero.');
assert.equal(M.evm(p,costs,'2026-11-05',{...approved,activity_costs:approved.activity_costs.slice(0,1)}).validBaseline,false);
assert.equal(M.evm({...p,baseline:[]},costs,'2026-11-05',approved).validBaseline,false);
console.log('PASS: PM offer/initial/EAC margins, immutable history, approved-baseline EVM, missing-data guards and chart.');
