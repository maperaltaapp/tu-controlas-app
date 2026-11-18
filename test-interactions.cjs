const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const handlers={},timers=new Map(),storage=new Map();let timerId=0,frameId=0,committed=null,selected=null,edited=null,renders=0,ghosts=[];
const classes=(...initial)=>{const s=new Set(initial);return {add:(...x)=>x.forEach(a=>s.add(a)),remove:(...x)=>x.forEach(a=>s.delete(a)),contains:x=>s.has(x)}};
const rows=[{id:'parent',level:1},{id:'a',level:2,parent_id:'parent'},{id:'b',level:2,parent_id:'parent'},{id:'last',level:1}];
function node(id,y){const controls={prepend(){}},name={dataset:{inlineEdit:id},querySelector:()=>null};const row={dataset:{row:id},offsetHeight:54,style:{},classList:classes(),getBoundingClientRect:()=>({left:0,top:y,width:360,height:54}),querySelector:s=>s==='.g-row-controls'?controls:name,querySelectorAll:()=>[],cloneNode(){const g={...row,style:{},classList:classes(),removeAttribute(){},remove(){ghosts=ghosts.filter(x=>x!==g)}};return g}};name.closest=s=>s==='.is-delete-selected'&&row.classList.contains('is-delete-selected')?row:s==='.g-grid-row'?row:s==='.g-activity-cell'?cell:null;const cell={closest:s=>s==='.g-grid-row'?row:null,setPointerCapture(){}};return {row,cell,name}}
const nodes=rows.map((r,i)=>node(r.id,100+i*54));
const root={addEventListener:(name,fn)=>{(handlers[name]??=[]).push(fn)},querySelectorAll:s=>s==='.g-grid-row'?nodes.map(n=>n.row):[]};
const ctx=vm.createContext({console,structuredClone,Date,Math,Set,Map,Number,String,innerHeight:800,
 document:{getElementById:()=>root,querySelectorAll:()=>[],createElement:()=>({style:{},classList:classes()}),body:{append:g=>ghosts.push(g)}},
 window:{scrollBy(){}},G2:{zoom:1,busy:false},calZoom:1,localStorage:{setItem:(k,v)=>storage.set(k,v)},
 setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>++frameId,cancelAnimationFrame(){},
 selectHeldForDelete:(host,kind,id)=>{selected=id;host.classList.add('is-delete-selected')},gRows:()=>rows,gHydrate:structuredClone,gConnect(){},gCommit:async r=>{committed=r},
 editHeldField:(f,k,id)=>edited=id,showInlineTaskEditor(){},gRender:()=>renders++,calendar:()=>renders++});
vm.runInContext(fs.readFileSync(__dirname+'/interaction-refinement.js','utf8'),ctx);
const run=s=>vm.runInContext(s,ctx);
ctx.fixture=structuredClone(rows);const moved=run("tcReorder(fixture,'last','parent',false)");assert.deepEqual(Array.from(moved,r=>r.id),['last','parent','a','b']);assert.equal(JSON.stringify(rows),JSON.stringify(ctx.fixture));
assert.equal(run("tcReorder(fixture,'parent','a',false)"),ctx.fixture);assert.equal(run("tcReorder(fixture,'a','last',false)"),ctx.fixture);
const movedChild=run("tcReorder(fixture,'b','a',false)");assert.deepEqual(Array.from(movedChild,r=>r.id),['parent','b','a','last']);assert.equal(movedChild[1].parent_id,'parent');
function event(target,y=270){return {target,button:0,pointerId:1,clientX:50,clientY:y,preventDefault(){},stopImmediatePropagation(){},stopPropagation(){}}}
const fire=async(name,e)=>{for(const fn of handlers[name]||[])await fn(e)};
const target=n=>({closest:s=>s==='.g-activity-cell'?n.cell:s==='.g-grid-row'?n.row:s==='[data-inline-task],.g-name[data-inline-edit]'?n.name:null});
(async()=>{
 const last=nodes[3],e=event(target(last));await fire('pointerdown',e);assert.equal(selected,null);assert.equal(ghosts.length,0);
 for(const [id,fn]of [...timers]){timers.delete(id);fn()}
 assert.equal(selected,'last');assert.equal(ghosts.length,1);assert(ghosts[0].classList.contains('tc-floating-row'));
 await fire('pointermove',event(target(last),85));await fire('pointerup',event(target(last),85));
 assert.deepEqual(Array.from(committed,r=>r.id),['last','parent','a','b']);assert.equal(ghosts.length,0);
 // Two fingers adjust only the visual scale, retaining all planning rows.
 const before=JSON.stringify(rows),sheet={style:{}},host={matches:()=>true,querySelector:()=>sheet};
 const touch=(a,b)=>({target:{closest:()=>host},touches:[{clientX:0,clientY:a},{clientX:0,clientY:b}],preventDefault(){}});
 await fire('touchstart',touch(0,100));await fire('touchmove',touch(0,200));await fire('touchend',{touches:[]});
 assert.equal(ctx.G2.zoom,2);assert.equal(storage.get('tc_gantt_zoom'),'2');assert.equal(JSON.stringify(rows),before);assert.equal(renders,1);
 console.log('PASS: long-press selection, floating drag preview, end-to-start drop, subtree and parent conservation, forbidden self-drop, pinch scale persistence and unchanged planning dates.');
})().catch(e=>{console.error(e);process.exitCode=1});
