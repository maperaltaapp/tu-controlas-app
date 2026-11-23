const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const html=fs.readFileSync(__dirname+'/index.html','utf8');const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const map=new Map();function el(id){if(!map.has(id))map.set(id,{id,innerHTML:'',textContent:'',value:'',disabled:false,style:{},attributes:{},parentElement:{insertAdjacentHTML(){}},classList:{add(){},remove(){},toggle(){}},setAttribute(name,value){this.attributes[name]=String(value)},getAttribute(name){return this.attributes[name]??null},querySelector(sel){return el(this.id+sel)},querySelectorAll(){return []},showModal(){},close(){},remove(){map.delete(this.id)},focus(){},addEventListener(){},append(){},appendChild(){},insertAdjacentHTML(){},getClientRects(){return [1]}});return map.get(id)}
const ctx=vm.createContext({console,Date,Map,URL,URLSearchParams,crypto,MutationObserver:class{observe(){}},localStorage:{getItem(){return null},setItem(){},removeItem(){}},document:{getElementById:el,querySelectorAll(){return []},querySelector(){return null},createElement(){return el('taskDialog')},body:{appendChild(){},append(){}}},window:{isSecureContext:true},navigator:{},location:{search:'',pathname:'/'},history:{replaceState(){}},setTimeout,clearTimeout});
ctx.window=ctx;vm.runInContext(fs.readFileSync(__dirname+'/work-calendar.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/shared-holidays.js','utf8'),ctx);ctx.structuredClone=structuredClone;vm.runInContext(fs.readFileSync(__dirname+'/planning-engine.js','utf8'),ctx);vm.runInContext(fs.readFileSync(__dirname+'/planning-hierarchy.js','utf8'),ctx);vm.runInContext(script,ctx);const run=s=>vm.runInContext(s,ctx);const t=(id,patch={})=>({id,title:'Revisar planos de prueba',category:'work',work_id:'w1',work_name:'Obra prueba',due_at:'2026-10-12T08:00:00Z',start_at:null,status:'pending',completed:false,priority:'normal',stage:'Preparación',labels:[],checklists:[],recurrence:'none',updated_at:'2026-10-12T07:00:00Z',...patch});

const rows=[t('t1',{title:'Revisar planos cimentación',priority:'urgent',labels:['material']}),t('t2',{title:'Comprar acero'}),t('no-date',{title:'Verificar sin fecha',due_at:null}),t('done',{title:'Terminada',completed:true,status:'done'}),t('arch',{title:'Archivada',deleted_at:'2026-10-11T08:00Z'}),t('hidden-work',{work_id:'w2',title:'Obra archivada'}),t('gantt',{title:'Hormigón limpieza',stage:'Gantt',start_at:'2026-10-10T07:00Z'}),t('personal',{work_id:null,category:'personal',title:'Comprar fruta'}),t('future',{title:'Tarea ordinaria futura',due_at:new Date(Date.now()+2*86400000).toISOString()})];
ctx.fixtures=rows;run("OWN_TASKS=fixtures;NATIVE_WORKS=[{id:'w1',name:'Obra prueba',execution_state:'execution',stages:['Preparación']},{id:'w2',name:'Obra archivo',archived_at:'2026-10-10'}];nativeReady=true;render()");
const contains=id=>el('taskResults').innerHTML.includes(`data-hold-id="${id}"`);
assert.equal(run('mode'),'tasks');assert.equal(run('taskFilter'),'all');assert(contains('t1'));assert(contains('no-date'));assert(!contains('done'));assert(!contains('arch'));assert(!contains('hidden-work'));assert(contains('gantt'));assert(contains('future'));const upcoming=el('taskResults').innerHTML.split('id="home-future"')[1].split('</section>')[0];assert(upcoming.includes('data-hold-id="future"'));assert(!upcoming.includes('data-hold-id="gantt"'));assert.equal(run("homeGroup(fixtures.find(t=>t.id==='gantt'))"),'gantt');
assert.equal(run("homeGroup({...fixtures.find(t=>t.id==='gantt'),due_at:'2026-11-20T12:00:00Z'},'2026-11-20')"),'gantt');
assert.equal(run("homeGroup({...fixtures.find(t=>t.id==='gantt'),due_at:'2026-11-21T12:00:00Z'},'2026-11-20')"),'gantt');
assert.equal(run("homeGroup({...fixtures.find(t=>t.id==='future'),due_at:'2026-11-21T12:00:00Z'},'2026-11-20')"),'future');
assert(!el('homeCounts').innerHTML.includes('Urgente de hoy'));assert(el('homeCounts').innerHTML.includes('Hoy'));
run("tasks('done')");assert(contains('done'));assert(!contains('t1'));run("tasks('archived')");assert(contains('arch'));
run("tasks('all');taskPriority='urgent';renderTaskResults()");assert(contains('t1'));assert(!contains('t2'));
run("taskPriority='all';taskQuery='material';renderTaskResults()");assert(contains('t1'));assert(!contains('t2'));
run("taskQuery='';taskSource='gantt';renderTaskResults()");assert(contains('gantt'));assert(!contains('t1'));
run("taskSource='all';CHECKLIST_ITEMS=[{id:'check',work_id:'w1',title:'Verificar ferralla',due_date:'2026-11-18'}];tasks()");assert(contains('check'));assert.equal((el('taskResults').innerHTML.match(/data-hold-id="check"/g)||[]).length,1);
assert.equal(run("safeChatUrl('javascript:alert(1)')"),'');assert.equal(run("safeChatUrl('https://chatgpt.com.evil.example/c/123')"),'');assert.equal(run("safeChatUrl('https://chatgpt.com/c/123')"),'https://chatgpt.com/c/123');
run("openTaskForm('t1')");assert(el('taskDialog').innerHTML.includes('Revisar planos cimentación'));assert(el('taskDialog').innerHTML.includes('Checklists'));
function setForm(patch={}){const vals={ownTitle:'Tarea nueva de prueba',ownCategory:'work',ownWorkId:'w1',ownDescription:'Notas',ownStart:'2026-10-13T08:00',ownDue:'2026-10-13T09:00',ownState:'pending',ownPriority:'high',ownLabels:'acero, pedidos',ownStage:'Preparación',ownRecurrence:'weekly',ownReminder:'15',...patch};for(const [key,value]of Object.entries(vals))el(key).value=value}
setForm();run("editorChecks=[{id:'cl1',name:'Control',items:[{id:'i1',text:' Revisar medidas ',done:true}]}]");let body=run('collectNativeTask()');assert.equal(body.work_id,'w1');assert.equal(body.checklists[0].items[0].text,'Revisar medidas');assert(body.checklists[0].items[0].done);assert.equal(body.recurrence_timezone,'Europe/Madrid');assert(!('user_id'in body));setForm({ownDue:''});assert.throws(()=>run('collectNativeTask()'),/vencimiento/);setForm({ownStart:'2026-10-14T08:00'});assert.throws(()=>run('collectNativeTask()'),/posterior/);
run("openTaskForm('t1')");setForm({ownState:'done',ownStage:'SHOULD NOT CHANGE'});assert.equal(run('collectNativeTask().status'),'pending');assert.equal(run('collectNativeTask().stage'),'Preparación');
run("mode='calendar';calMode='month';calCursor=new Date(2026,9,12);calendar()");assert(!el('content').innerHTML.includes('type="checkbox"'));run("calMode='week';calendar()");assert(el('content').innerHTML.includes('type="checkbox"'));
run("renderFollowup()");assert(el('content').innerHTML.includes('Historial de partes'));assert.equal((el('content').innerHTML.match(/tc-part-create/g)||[]).length,1);assert(!el('content').innerHTML.includes('Importe valorado'));
// Real deletion regression: redistribute the deleted leaf before removal, excluding milestones.
(async()=>{
ctx.deletionRows=[{id:'a',weight:60},{id:'b',weight:40},{id:'m',weight:0,milestone:true}];
const next=await run("redistributeDeletedWeight(deletionRows,'a')");assert.equal(next.find(r=>r.id==='b').weight,100);assert.equal(next.find(r=>r.id==='m').weight,0);assert(!next.some(r=>r.id==='a'));
let requests=[];ctx.fetch=async(url,opt={})=>{requests.push({url,opt});return {ok:true,status:200,text:async()=>JSON.stringify([])}};run("session={access_token:'fixture'}");await assert.rejects(run("patchNativeTask(OWN_TASKS[0],{priority:'low'})"),/otro dispositivo/);assert(requests[0].url.includes('updated_at=eq.'));
let completionCalls=0;ctx.completionCheckbox={checked:true,disabled:false};ctx.fetch=async(url,opt={})=>{if(url.includes('/rpc/elite_complete_task')){completionCalls++;assert.equal(JSON.parse(opt.body).task_id,'t1');assert.equal(JSON.parse(opt.body).expected_updated_at,rows[0].updated_at);return {ok:true,status:200,text:async()=>''}}return {ok:true,status:200,text:async()=>JSON.stringify(rows.map(t=>t.id==='t1'?{...t,completed:true,status:'done'}:t))}};
run("OWN_TASKS=fixtures;WORK_PLANS=[];workDetailId=null;mode='tasks';taskFilter='all'");await run("toggleTaskComplete('t1',completionCheckbox)");assert.equal(completionCalls,1);assert(!contains('t1'));run("tasks('done')");assert(contains('t1'));
run('OWN_TASKS=fixtures');ctx.completionCheckbox={checked:true,disabled:false};ctx.fetch=async()=>({ok:false,status:500,text:async()=>JSON.stringify({message:'Error de prueba'})});await run("toggleTaskComplete('t1',completionCheckbox)");assert.equal(ctx.completionCheckbox.checked,false);assert.equal(ctx.completionCheckbox.disabled,false);
vm.runInContext(fs.readFileSync(__dirname+'/auth-session.js','utf8'),ctx);run("session={access_token:'fixture',user:{id:'a'}};currentSubscription=async()=>{throw Error('offline')};OWN_TASKS=fixtures");await run('logoutElite()');assert.equal(run('session'),null);assert.equal(run('OWN_TASKS.length'),0);assert.equal(el('loginStatus').textContent,'Sesión cerrada.');
let unblock;ctx.deferred=new Promise(resolve=>unblock=resolve);run("session={access_token:'fixture'};readAll=async()=>deferred");const obsolete=run('load()');run("sessionViewEnded('Prueba de sesión cambiada')");unblock([{id:'old-user-row'}]);await obsolete;assert.equal(run('NATIVE_WORKS.length'),0);assert.equal(run('OWN_TASKS.length'),0);

// A partial task reload must never restore data from the previous customer after logout/switch.
let releaseTasks;
ctx.deferred=new Promise(resolve=>releaseTasks=resolve);
run("session={access_token:'fixture-a',user:{id:'a'}};OWN_TASKS=[];readAll=async()=>deferred");
const staleTasks=run('fetchOwnTasks()');
run("sessionViewEnded('Sesión anterior cerrada');session={access_token:'fixture-b',user:{id:'b'}}");
releaseTasks([{id:'private-task-from-A',user_id:'a',title:'Confidencial A'}]);
await assert.rejects(staleTasks,/sesión cambió/);
assert.equal(run('OWN_TASKS.length'),0,'Stale task response must not populate customer B view');
assert.equal(run("session.user.id"),'b');

// An HTTP response body finishing after logout must also be discarded, including success.
let releaseBody;
const bodyPending=new Promise(resolve=>releaseBody=resolve);
ctx.fetch=async()=>({ok:true,status:200,text:()=>bodyPending});
run("session={access_token:'fixture-a2',user:{id:'a'}}");
const slowResponse=run("eliteRequest('/rest/v1/elite_tasks')");
await Promise.resolve();
run("sessionViewEnded('Sesión terminada')");
releaseBody(JSON.stringify([{id:'sensitive-task',user_id:'a'}]));
await assert.rejects(slowResponse,/sesión cambió/);
assert.equal(run('OWN_TASKS.length'),0);

// A retry of a POST on HTTP 401 must never be replayed using another customer's token.
let requestsAfter401=0;
const stored={access_token:'fixture-b',refresh_token:'rotated-b',user:{id:'b'}};
ctx.localStorage.getItem=(key)=>key==='tc_session_v1'?JSON.stringify(stored):null;
ctx.fetch=async()=>{requestsAfter401++;return{ok:false,status:401,text:async()=>JSON.stringify({code:'401'})}};
run("session={access_token:'fixture-a3',user:{id:'a'}}");
await assert.rejects(run("eliteRequest('/rest/v1/rpc/elite_complete_task',{method:'POST',body:'{}'})"),/cuenta cambió/);
assert.equal(requestsAfter401,1,'Never replay a write under a different user's authentication');

console.log('PASS: current task views, Gantt filter, checklist dates, archived isolation, safe links, date validation, hidden fields, Partes, deletion weights, stale-edit protection, completion roundtrip and failure rollback.');
})().catch(e=>{console.error(e);process.exitCode=1});
// Checklist dates use the canonical field, including Madrid midnight and date removal.
run("CHECKLIST_ITEMS=[{id:'dated-check',work_id:'w1',title:'Planos QA',due_date:'2026-11-20'}]");
assert.equal(run("homeGroup(homeCards().find(c=>c.id==='dated-check'),'2026-11-20')"),'today');
run("CHECKLIST_ITEMS[0].due_date='2026-11-21'");assert.equal(run("homeGroup(homeCards().find(c=>c.id==='dated-check'),'2026-11-20')"),'future');
run("CHECKLIST_ITEMS[0].due_date='2026-11-19'");assert.equal(run("homeGroup(homeCards().find(c=>c.id==='dated-check'),'2026-11-20')"),'overdue');
run("CHECKLIST_ITEMS[0].due_date=null");assert.equal(run("homeCards().filter(c=>c.id==='dated-check').length"),0);
assert.equal(run("homeGroup({due_at:'2026-11-19T23:30:00Z'},'2026-11-20')"),'today');
assert.equal(run("cardDue({due_at:'2026-11-20',due:'2020-01-01'})"),'2026-11-20');
assert.equal(run("cardDue({due_date:'2026-11-20'})"),'2026-11-20','Checklist date-only field must not display Sin fecha');
assert.equal(run("cardDue({due_at:'2026-11-22T08:00:00Z',due_date:'2026-11-20'})"),'2026-11-22T08:00:00Z','Native timestamp wins if both fields exist');
assert.equal(run("validTaskDate({due_date:'2026-11-20'}).toISOString()"),'2026-11-20T12:00:00.000Z','Date-only must be normalized to noon UTC for Madrid');
assert.equal(run("homeGroup({due_date:'2026-11-20'},'2026-11-20')"),'today','Direct checklist view must recognize the date');
assert.equal(run("homeGroup({due_date:'2026-11-19'},'2026-11-20')"),'overdue');
assert.equal(run("homeGroup({due_date:'2026-11-21'},'2026-11-20')"),'future');
assert.equal(run("validTaskDate({due_date:'fecha-inválida'})"),null,'Invalid checklist date cannot be rendered as a real date');

