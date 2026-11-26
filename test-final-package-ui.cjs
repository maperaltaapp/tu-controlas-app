// DOM integration with fictitious data: startup, canonical edits and stale-account responses.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{parseHTML}=require('linkedom'),crypto=require('node:crypto').webcrypto;
const html=fs.readFileSync('index.html','utf8'),{window}=parseHTML(html),document=window.document;
window.HTMLElement.prototype.showModal=function(){this.setAttribute('open','')};window.HTMLElement.prototype.close=function(){this.removeAttribute('open')};
window.HTMLElement.prototype.getBoundingClientRect=function(){return {x:0,y:0,top:0,left:0,right:100,bottom:44,width:100,height:44}};
window.HTMLElement.prototype.scrollIntoView=function(){};
window.HTMLInputElement.prototype.setSelectionRange=function(){};
Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||''},set(v){this.querySelectorAll('option').forEach(o=>{if(o.value===String(v))o.setAttribute('selected','');else o.removeAttribute('selected')})}});
const prompts=[],messages=[],storage=new Map(),ctx=vm.createContext({document,console,crypto,Date,URL,URLSearchParams,Map,Set,TextEncoder,TextDecoder,Blob,structuredClone,location:{href:'http://qa.invalid/',origin:'http://qa.invalid',search:'',pathname:'/',hash:''},history:{replaceState(){}},navigator:{},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},addEventListener(){},removeEventListener(){},setTimeout,clearTimeout,requestAnimationFrame:()=>0,cancelAnimationFrame(){},MutationObserver:window.MutationObserver,Event:window.Event,confirm:()=>true,prompt:()=>prompts.shift()??null});ctx.window=ctx;
for(const script of document.querySelectorAll('script')){const src=script.getAttribute('src')?.split('?')[0];if(src?.startsWith('http'))continue;vm.runInContext(src?fs.readFileSync(src,'utf8'):script.textContent,ctx,{filename:src||'index-inline.js'})}
const run=s=>vm.runInContext(s,ctx),id='11111111-1111-4111-8111-111111111111',item='22222222-2222-4222-8222-222222222222';
run(`session={access_token:'fixture',user:{id:'A'}};nativeReady=true;NATIVE_WORKS=[{id:'${id}',user_id:'A',name:'Obra de prueba',execution_state:'execution',updated_at:'v1',workspace_layout:null}];WORK_PLANS=[{work_id:'${id}',revision:1,phases:[{id:'leaf',name:'Partida',start:'2026-11-01',end:'2026-12-01',weight:100,observations:[{date:'2026-11-25',percent:50}]}],baseline:[{id:'leaf',name:'Partida',start:'2026-11-01',end:'2026-12-01',weight:100}],baseline_at:'2026-11-01'}];CHECKLIST_ITEMS=[{id:'${item}',work_id:'${id}',section:'prep',title:'Ensayo',notes:'Dato original',position:0,updated_at:'r1'}];checkWorkId='${id}';checkSection='prep';statusMessage=(m)=>messages.push(m);`);ctx.messages=messages;
(async()=>{
 run('tasks()');assert(!document.getElementById('filterWork'));assert(document.getElementById('filterPriority'));assert(document.querySelector('#content .tc-task-history'));assert(!document.querySelector('#content #newOwn'));
 run('renderChecklist()');assert.equal(document.querySelectorAll('[data-sheet-type]').length,4);assert.equal(document.querySelectorAll('.tc-sheet-table tbody tr').length,1);assert(!document.querySelector('.tc-sheet h2'));assert.equal(document.querySelector('input[aria-label="Notas · Ensayo"]').value,'Dato original');
 // Navigation regression: first entry fetches three canonical collections; switching
 // between types and works must not perform any network read. Reentry refreshes.
 const reads=[];const checklistTables=['elite_tasks','elite_work_checklist_items','elite_work_contractors'].sort();const readSnapshot=async(table)=>{if(checklistTables.includes(table))reads.push(table);return table==='elite_work_checklist_items'?run('CHECKLIST_ITEMS'):[]};ctx.readAll=readSnapshot;
 run("selectSection('tasks')");await run("openChecklist('prep')");
 assert.deepEqual([...reads].sort(),checklistTables,'initial entry must read each checklist table once');
 await run("openChecklist('providers')");assert.equal(reads.length,3);assert.equal(run('checkSection'),'providers');
 await run("openChecklist('prep')");assert.equal(reads.length,3);
 assert.equal(document.querySelector('input[aria-label="Notas · Ensayo"]').value,'Dato original');
 run("selectSection('works')");await run("openChecklist('prep')");assert.equal(reads.length,6);
 // A failed first read cannot promote a stale snapshot into an active cache.
 run("selectSection('works')");ctx.readAll=async()=>{throw Error('Sin conexión')};
 await run("openChecklist('prep')");assert(document.getElementById('content').textContent.includes('Sin conexión'));
 ctx.readAll=readSnapshot;
 await run("openChecklist('prep')");assert.equal(reads.length,9);
 // A late first-load response from another account cannot enter B's cache.
 run("selectSection('works')");let release;const slow=new Promise(r=>release=r);ctx.readAll=()=>slow;
 const original=run('CHECKLIST_ITEMS');const old=run("openChecklist('prep')");
 run("sessionEpoch++;session={access_token:'B',user:{id:'B'}};CHECKLIST_ITEMS=[];WORK_CONTRACTORS=[];OWN_TASKS=[]");
 release(original);await old;assert.equal(run('CHECKLIST_ITEMS.length'),0);
 run("sessionEpoch++;session={access_token:'fixture',user:{id:'A'}}");run("selectSection('works')");
 ctx.readAll=async(table)=>table==='elite_work_checklist_items'?original:[];
 await run("openChecklist('prep')");assert.equal(run('CHECKLIST_ITEMS.length'),1);
 const writes=[];ctx.capture=async(path,opts)=>{const payload=JSON.parse(opts.body);writes.push({path,payload});if(path.includes('elite_works'))return [{...run('NATIVE_WORKS[0]'),...payload,updated_at:'v'+writes.length}];return [{...run('CHECKLIST_ITEMS[0]'),...payload,updated_at:'r'+writes.length}]};run('eliteRequest=capture');
 await run(`tcSheetCell('${item}','title','Ensayo corregido')`);assert.equal(run('CHECKLIST_ITEMS[0].title'),'Ensayo corregido');assert(writes[0].path.includes('updated_at=eq.r1'));
 prompts.push('Resistencia');run('tcSheetAddColumn()');await new Promise(r=>setTimeout(r,0));assert(document.querySelector('[data-column-menu^="col_"]'));assert(run('NATIVE_WORKS[0].workspace_layout.sheets.prep.columns.length')===5);
 const col=run('NATIVE_WORKS[0].workspace_layout.sheets.prep.columns.at(-1).id');await ctx.tcSheetCell(item,col,'40 MPa');assert.equal(run('CHECKLIST_ITEMS[0].cell_values')[col],'40 MPa');
 assert(!document.querySelector('.tc-sheet input[type=range]'));
 assert(document.querySelector('.tc-sheet-table.control-table th[scope=row]'));
 assert(document.querySelector('.tc-sheet-table .tc-completion.control-pending'));
 ctx.tcSheetColumn(col);document.getElementById('tcColumnWidth').value='215';
 await document.getElementById('tcColumnForm').onsubmit({preventDefault(){}});
 assert.equal(run('NATIVE_WORKS[0].workspace_layout.sheets.prep.widths')[col],215);
 ctx.tcSheetColumn(col);await document.getElementById('tcColumnHide').onclick();
 assert(!document.querySelector('[data-column-menu="'+col+'"]'));assert.equal(run('CHECKLIST_ITEMS[0].cell_values')[col],'40 MPa');
 ctx.tcSheetRestoreColumns();await new Promise(r=>setTimeout(r,0));assert(document.querySelector('[data-column-menu="'+col+'"]'));
 const handle=document.querySelector('[data-column-resize="'+col+'"]');
 handle.onkeydown({key:'ArrowRight',preventDefault(){}});
 await new Promise(r=>setTimeout(r,0));assert.equal(run('NATIVE_WORKS[0].workspace_layout.sheets.prep.widths')[col],231);
 assert.equal(handle.getAttribute('aria-valuenow'),'231');

 run('openSettings()');assert(document.getElementById('exportClientData'));assert(!document.getElementById('tcBell'));run('works()');assert(!document.getElementById('exportClientData'));assert(document.querySelector('.tc-work-table'));assert.equal(document.querySelectorAll('.tc-work-table tbody tr').length,4);
 // Economic cells replace totals through the validated RPC; computed fields stay read-only.
 let costs=[{id:'cost-1',work_id:id,activity_id:'leaf',kind:'budget',amount:1000,entry_date:'2026-11-01',source_name:'Entrada manual'},{id:'cost-2',work_id:id,activity_id:'leaf',kind:'actual',amount:600,entry_date:'2026-11-01',source_name:'factura.pdf'}];
 ctx.readAll=async()=>costs;ctx.eliteRequest=async(path,opts)=>{const payload=JSON.parse(opts.body);assert(path.includes('tc_set_manual_cost'));assert.equal(payload.expected_rows[0].id,'cost-1');costs=costs.map(e=>e.kind==='budget'?{...e,amount:payload.new_total}:e);return payload.new_total};
 await ctx.tcOpenEconomy(id);assert(!document.getElementById('ecCosts').hasAttribute('open'));document.getElementById('ecCosts').open=true;assert(!document.getElementById('ecRecord'));assert(!document.getElementById('ecGantt'));assert(document.querySelector('[data-cost-kind="actual"]').hasAttribute('readonly'));const costInput=document.querySelector('[data-cost-kind="budget"]');costInput.value='1250';await costInput.onchange();assert.equal(document.querySelector('[data-cost-kind="budget"]').value,'1250');assert.equal(document.getElementById('ecCosts').open,true);assert(document.querySelector('.ec-card svg[aria-label="Curva S de coste planificado y coste real acumulado"]'));
 // Work exceptions are chosen visually, while the proposal remains uncommitted.
 run(`tcEditWorkCalendar('${id}')`);assert(document.getElementById('wcExceptions').querySelector('[data-wc-day="2026-11-07"]'));assert(document.getElementById('wcDayEditor').hidden);document.querySelector('[data-wc-day="2026-11-07"]').onclick();assert.equal(document.getElementById('wcDate').value,'2026-11-07');assert.equal(document.getElementById('wcWorking').value,'true');document.getElementById('wcAdd').onclick();assert(document.querySelector('[data-wc-day="2026-11-07"]').classList.contains('is-exception'));assert.equal(document.querySelector('[data-wc-day="2026-11-07"]').dataset.working,'true');document.getElementById('wcPreview').onclick();assert.equal(document.getElementById('wcSave').disabled,false);assert(document.getElementById('wcReasonRow').hidden);assert.equal(run('WORK_PLANS[0].revision'),1);
 run('closeTaskDialog()');
 // No late account A write response may enter the account B cache.
 run('renderChecklist()');let resolve;ctx.eliteRequest=()=>new Promise(r=>resolve=r);const pending=ctx.tcSheetCell(item,'notes','No debe aparecer en B');run("sessionEpoch++;session={access_token:'B',user:{id:'B'}};CHECKLIST_ITEMS=[]");resolve([{id:item,title:'A'}]);await pending;assert.equal(run('CHECKLIST_ITEMS.length'),0);
 console.log('PASS: full script startup, compact task controls, editable checklist columns, hidden-column recovery, preserved values, settings move, state tables and stale-account write rejection');
})().catch(e=>{console.error(e);process.exitCode=1});
