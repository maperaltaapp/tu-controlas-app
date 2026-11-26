const assert=require('node:assert/strict'),W=require('./economic-weights.js');
const sum=a=>a.reduce((x,y)=>x+y,0);
assert.deepEqual(W.allocate([20000,30000,50000]),[20,30,50]);
assert.deepEqual(W.equalAdjust([20,30,50],0,30),[30,25,45]);
assert.deepEqual(W.equalAdjust([20,30,50],0,10),[10,35,55]);
assert.deepEqual(W.equalAdjust([20,30,50],0,90),[90,0,10],'Water filling caps smaller others at zero.');
assert.deepEqual(W.equalAdjust([50,50],0,100),[100,0]);
assert.deepEqual(W.equalAdjust([100],0,100),[100]);
assert.throws(()=>W.equalAdjust([100],0,50),/100/);
assert.throws(()=>W.equalAdjust([30,30,30],0,50),/100/);
assert.throws(()=>W.allocate([0,0]),/mayor que cero/);
assert.deepEqual(W.allocate([0,500,500]),[0,50,50]);
assert.deepEqual(W.allocate([1,1,1]),[33.34,33.33,33.33]);
for(let n=2;n<=100;n++){
 const costs=Array.from({length:n},(_,i)=>((i+1)*117)%193+1);
 const weights=W.allocate(costs);
 assert.equal(sum(weights.map(x=>Math.round(x*100))),10000);
 for(const index of [0,Math.floor(n/2),n-1]){
  const target=Math.min(100,Math.max(0,weights[index]+(index%2?7.53:-2.17)));
  const adjusted=W.equalAdjust(weights,index,target);
  assert.equal(sum(adjusted.map(x=>Math.round(x*100))),10000);
  assert(adjusted.every(x=>x>=0&&x<=100));
  assert.equal(adjusted[index],Math.round(target*100)/100);
 }
}
const phases=[{id:'p',is_group:true,weight:0},{id:'a',parent_id:'p',weight:20},{id:'b',parent_id:'p',weight:30},{id:'c',weight:50}];
const plan={phases,baseline:[{id:'a',weight:30},{id:'b',weight:70}]};
const budget=[{kind:'budget',activity_id:'a',amount:20000,entry_date:'2026-11-01'},{kind:'budget',activity_id:'b',amount:30000,entry_date:'2026-11-01'},{kind:'budget',activity_id:'c',amount:50000,entry_date:'2026-11-01'}];
const raw=W.derive(plan,budget,[],'2026-11-26');
assert.equal(raw.source,'budget');assert.deepEqual(raw.weights,[20,30,50]);
const approved=[{snapshot_type:'baseline',as_of:'2026-11-02',total_cost:120000,activity_costs:[{activity_id:'a',amount:60000},{activity_id:'b',amount:36000},{activity_id:'c',amount:24000}]}];
const cost=W.derive(plan,budget,approved,'2026-11-26');
assert.deepEqual(cost.weights,[50,30,20]);assert.equal(cost.source,'approved');
const wrong=W.derive(plan,budget,[{...approved[0],activity_costs:[{activity_id:'a',amount:1}]}],'2026-11-26');
assert.equal(wrong.source,'unavailable','Never silently fall back to cost of offer when approved execution baseline has mismatched activity IDs.');
const moved=W.apply(plan,cost.rows,[40,35,25],'manual');
assert.deepEqual(W.leaves(moved).map(x=>x.weight),[40,35,25]);assert.equal(moved[0].weight,0);
assert.equal(phases[1].weight,20);assert.equal(plan.baseline[0].weight,30);
assert.equal(W.derive({...plan,phases:moved},budget,approved,'2026-11-26').source,'manual');
assert.throws(()=>W.apply(plan,cost.rows,[40,34,25],'manual'),/100/);
console.log('PASS: auto cost weights, hierarchical leaves, exact 100.00%, equitably redistributed points, rounding, saturation, manual override and unchanged original baseline');
